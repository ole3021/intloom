import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const read = (name) => readFile(join(dist, name), "utf8");
const stylesheetLinks = (html) =>
  [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map(
    ([tag]) => tag.match(/href="([^"]+)"/)[1],
  );

async function pages(directory = dist) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return pages(path);
      return entry.name.endsWith(".html") ? [path] : [];
    }),
  );
  return paths.flat();
}

test("homepage styles are linked before first paint and excluded from other pages", async () => {
  const home = await read("index.html");
  const head = home.slice(0, home.indexOf("</head>"));
  const links = stylesheetLinks(head);
  const homeLinks = links.filter((href) => /\/home\.[\da-f]+\.css$/.test(href));
  assert.equal(
    homeLinks.length,
    1,
    "SSR homepage must link its stylesheet in head",
  );
  const homeCss = await read(homeLinks[0].slice(1));
  // Read emitted names from semantic markup; CSS Modules hashes may change.
  const markers = [
    /<section\b[^>]*aria-labelledby="home-title"[^>]*>/,
    /<section\b[^>]*id="development"[^>]*>/,
    /<canvas\b[^>]*role="img"[^>]*>/,
    /<div\b[^>]*data-started="[^"]+"[^>]*data-paused="[^"]+"[^>]*>/,
  ];
  const selectors = markers.flatMap((marker) => {
    const tag = home.match(marker)?.[0];
    assert.ok(tag, `homepage contains ${marker}`);
    const classes = tag.match(/class="([^"]+)"/)?.[1];
    assert.ok(classes, `${tag} has generated classes`);
    return classes.split(/\s+/).map((name) => `.${name}`);
  });
  for (const [, classes] of home.matchAll(/class="([^"]*)"/g)) {
    assert.ok(
      !classes.split(/\s+/).includes("undefined"),
      "CSS module exports resolve",
    );
  }
  for (const selector of selectors) {
    assert.ok(
      homeCss.includes(selector),
      `homepage chunk contains ${selector}`,
    );
  }
  for (const page of await pages()) {
    if (page === join(dist, "index.html")) continue;
    const html = await readFile(page, "utf8");
    assert.ok(
      !html.includes(homeLinks[0]),
      `${page} must not request homepage CSS`,
    );
    for (const href of stylesheetLinks(html)) {
      const css = await read(href.slice(1));
      assert.ok(
        !selectors.some((selector) => css.includes(selector)),
        `${page} must not load KV/home rules through a shared file`,
      );
    }
  }
});
