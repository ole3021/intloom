import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { readdir } from "node:fs/promises";
import { test } from "node:test";
import { promisify, stripVTControlCharacters } from "node:util";
import { verifyCliRelease } from "./verify-cli-release.mjs";

const site = new URL("../", import.meta.url);
const run = promisify(execFile);
const env = { ...process.env, NO_COLOR: "1" };
const pages = [
  ["/", "Packaged intelligence"],
  ["/looms", "Loom index"],
  ["/docs/", "What can I do with IntLoom?"],
  ["/zh/docs/", "IntLoom 能用来做什么？"],
  ["/docs/use/meeting-notes", "Turn meeting notes into minutes"],
  ["/zh/docs/use/meeting-notes", "从会议原文生成纪要"],
];
async function withServer(command, inspect) {
  const child = spawn("bun", ["run", command, "--port", "0"], {
    cwd: site,
    env: { ...env, PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });
  const closed = once(child, "close");
  let output = "";
  const { promise: listening, resolve, reject } = Promise.withResolvers();
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });
  child.stdout.on("data", (chunk) => {
    output += chunk;
    const local = stripVTControlCharacters(output).match(
      /Local:\s+http:\/\/[^\s/]+:(\d+)\//,
    );
    // The dev server prints its URL before the first compilation finishes.
    if (
      local &&
      (command === "preview" ||
        /ready\s+built in/.test(stripVTControlCharacters(output)))
    ) {
      resolve(`http://127.0.0.1:${local[1]}`);
    }
  });
  closed.then(
    () => reject(new Error(`${command} exited before startup\n${output}`)),
    reject,
  );
  const timeout = setTimeout(
    () => reject(new Error(`${command} startup timed out\n${output}`)),
    60_000,
  );
  try {
    const origin = await listening;
    const route = await fetch(`${origin}/api/releases`, { method: "POST" });
    assert.equal(route.status, 405);
    assert.equal(route.headers.get("allow"), "GET, HEAD");
    const download = await fetch(`${origin}/download/studio/unknown`);
    assert.equal(download.status, 404);
    await inspect(origin);
  } finally {
    clearTimeout(timeout);
    if (child.pid && child.exitCode === null && child.signalCode === null) {
      if (process.platform === "win32") child.kill();
      else process.kill(-child.pid, "SIGTERM");
    }
    await closed;
  }
}

async function get(origin, path, accept) {
  const response = await fetch(new URL(path, origin), {
    headers: { accept },
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(response.status, 200, path);
  return response;
}

async function checkDevPages(origin) {
  const scripts = new Set();
  for (const [path] of pages) {
    const response = await get(origin, path, "text/html");
    const html = await response.text();
    assert.match(html, /id="__rspress_root"/, path);
    const entries = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)];
    assert.ok(entries.length, `No browser entry scripts at ${path}`);
    for (const [, src] of entries)
      scripts.add(new URL(src, origin + path).href);
  }
  for (const src of scripts) {
    const response = await get(origin, src, "*/*");
    assert.match(response.headers.get("content-type") ?? "", /javascript/, src);
    assert.ok((await response.text()).trim().length, src);
  }
}

test("bun run dev serves the site and its browser entry scripts", async () => {
  await withServer("dev", checkDevPages);
});

test("bun run build produces working preview pages and downloads", async () => {
  await run("bun", ["run", "build"], { cwd: site, env, timeout: 120_000 });
  await withServer("preview", async (origin) => {
    for (const [path, heading] of pages) {
      const response = await get(origin, path, "text/html");
      const html = await response.text();
      const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1];
      assert.ok(h1?.includes(heading), `Missing page heading at ${path}`);
      if (path === "/") verifyCliRelease(html);
    }
    const files = await readdir(new URL("dist/", site), { recursive: true });
    assert.ok(
      !files.some((name) => /\.(?:tgz|zip|dmg|tar\.gz)$/.test(name)),
      "Website contains downloadable packages",
    );
    for (const path of [
      "/docs/use/meeting-notes",
      "/zh/docs/use/meeting-notes",
    ]) {
      const response = await get(origin, path, "text/html");
      const html = await response.text();
      assert.match(
        html.replace(/<[^>]*>/g, ""),
        /intloom install @intloom\/meeting-notes/,
      );
      assert.doesNotMatch(html, /meeting-notes[^<" ]*\.tgz/);
    }
  });
});

test("development server restarts after a production build", async () => {
  await withServer("dev", checkDevPages);
});
