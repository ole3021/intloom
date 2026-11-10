// Exercise registry-style installs before public versions exist.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createReadStream, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve, join } from "node:path";

const dir = resolve(process.argv[2]);
const { packages } = JSON.parse(
  readFileSync(join(dir, "candidate.json"), "utf8"),
);
const server = createServer((req, res) => {
  const path = decodeURIComponent(req.url.slice(1));
  const file = packages.find((p) => p.file === path);
  if (file) {
    createReadStream(join(dir, file.file)).pipe(res);
    return;
  }
  const pkg = packages.find(
    (p) => path === p.name || path.startsWith(`${p.name}/`),
  );
  if (!pkg) {
    res
      .writeHead(302, {
        Location: `https://registry.npmjs.org/${req.url.slice(1)}`,
      })
      .end();
    return;
  }
  const manifest = {
    ...pkg,
    dist: { integrity: pkg.integrity, tarball: `${origin}/${pkg.file}` },
  };
  res.setHeader("content-type", "application/json");
  if (path === pkg.name) {
    res.end(
      JSON.stringify({
        name: pkg.name,
        "dist-tags": { latest: pkg.version, next: pkg.version },
        versions: { [pkg.version]: manifest },
      }),
    );
  } else if (
    [pkg.version, "latest", "next"].includes(path.slice(pkg.name.length + 1))
  )
    res.end(JSON.stringify(manifest));
  else res.writeHead(404).end();
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  for (const unit of ["framework", "cli"]) {
    const child = spawn(
      process.execPath,
      [".github/scripts/release-npm-packages.mjs", "verify", unit, dir, origin],
      { stdio: "inherit" },
    );
    const [code] = await once(child, "exit");
    assert.equal(code, 0, `${unit} candidate registry checks`);
  }
} finally {
  server.close();
}
