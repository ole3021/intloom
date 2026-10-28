import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileLoom, scaffoldLoom, inspectLoom } from "@intloom/compiler";
test("App directories package built bytes, bind results, preserve the last good artifact on invalid inputs", async (t) => {
  const parent = await mkdtemp(join(tmpdir(), "loom-app-"));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const root = join(parent, "sample");
  await scaffoldLoom(root);
  await mkdir(join(root, "ui"));
  const html =
    "<!doctype html><html><body><script>globalThis.NOT_EXECUTED = true;</script>Ready</body></html>";
  await writeFile(join(root, "ui/index.html"), html);
  const original = await readFile(join(root, "loom.yaml"), "utf8");
  const yaml = `${original}\napps:\n  result:\n    path: ./ui\npresentation:\n  result:\n    app: result\n`;
  await writeFile(join(root, "loom.yaml"), yaml);
  await compileLoom({ packageRoot: root });
  assert.equal(
    await readFile(join(root, "dist/apps/result/index.html"), "utf8"),
    html,
  );
  const inspected = await inspectLoom(root);
  assert.equal(inspected.definition.apps?.result?.protocolVersion, "1");
  assert.equal(
    inspected.plan.steps.some((step) => String(step.kind).includes("app")),
    false,
  );
  await writeFile(
    join(root, "ui/index.html"),
    '<html><script src="/bundle.js"></script></html>',
  );
  await assert.rejects(compileLoom({ packageRoot: root }), /self-contained/);
  assert.equal(
    await readFile(join(root, "dist/apps/result/index.html"), "utf8"),
    html,
  );
  await writeFile(join(root, "ui/index.html"), html);
  await writeFile(
    join(root, "loom.yaml"),
    yaml.replace("app: result", "app: unknown"),
  );
  await assert.rejects(compileLoom({ packageRoot: root }), /Missing App/);
  await writeFile(join(root, "loom.yaml"), yaml);
  await symlink(join(root, "code/run.ts"), join(root, "ui/source.ts"));
  await assert.rejects(compileLoom({ packageRoot: root }), /symlinks/);
});
