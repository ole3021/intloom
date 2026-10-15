import assert from "node:assert/strict";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { LoomError } from "@intloom/utils";
import { workspace } from "../../test/helpers/workspace.ts";
import { editManifest, editStage } from "../../test/helpers/definition.ts";
import { loadSources } from "./load-sources.ts";
import type { CompilerDiagnostic } from "../diagnostics.ts";

test("loads only explicit references without executing modules, with JSON/YAML/Markdown locations", async (t) => {
  const { root } = await workspace(t);
  await writeFile(resolve(root, "stages/unreferenced.yaml"), "invalid: [");
  const result = await loadSources({ packageRoot: root });
  assert.equal(result.packageJson.value.loom.name, "compiler_fixture");
  assert.ok(result.packageJson.locations["/loom/entry"]?.line);
  assert.equal(result.resources.filter((r) => r.kind === "code").length, 1);
  const source = result.resources.find((r) => r.kind === "code");
  assert.ok(source && "source" in source);
  assert.match(source.source.text, /writeFileSync/);
  await assert.rejects(readFile(resolve(root, "module-loaded.txt")), {
    code: "ENOENT",
  });
  const agent = result.resources.find((r) => r.kind === "agent");
  assert.ok(agent?.kind === "agent");
  assert.equal(agent.metadata.locations["/name"]?.line, 2);
  assert.equal(
    result.references.find((r) => r.kind === "code")?.location.stepName,
    "run",
  );
});

for (const scenario of [
  "missing_package",
  "invalid_json",
  "missing_loom",
  "invalid_root",
  "missing_code",
  "missing_frontmatter",
  "outside_symlink",
] as const) {
  test(`rejects ${scenario}`, async (t) => {
    const { root } = await workspace(t);
    if (scenario === "missing_package") await rm(resolve(root, "package.json"));
    if (scenario === "invalid_json")
      await writeFile(resolve(root, "package.json"), "{");
    if (scenario === "missing_loom")
      await editManifest(root, (m) => {
        Reflect.deleteProperty(m, "loom");
      });
    if (scenario === "missing_code" || scenario === "outside_symlink")
      await rm(resolve(root, "codes/run.ts"));
    if (scenario === "missing_frontmatter")
      await writeFile(resolve(root, "agents/reviewer.md"), "body only");
    if (scenario === "outside_symlink") {
      await writeFile(resolve(root, "../outside.ts"), "export default 1;");
      await symlink(
        resolve(root, "../outside.ts"),
        resolve(root, "codes/run.ts"),
      );
    }
    const code =
      scenario === "invalid_json" || scenario === "missing_frontmatter"
        ? "SOURCE_PARSE_FAILED"
        : scenario === "missing_loom"
          ? "INVALID_LOOM"
          : scenario === "outside_symlink"
            ? "INVALID_REFERENCE"
            : "SOURCE_READ_FAILED";
    await assert.rejects(
      loadSources({
        packageRoot:
          scenario === "invalid_root" ? resolve(root, "missing") : root,
      }),
      (error) => LoomError.is(error) && error.code === code,
    );
  });
}

for (const field of ["input", "preHook", "postHook", "typo"] as const) {
  test(`rejects unsupported ${field} before following references`, async (t) => {
    const { root } = await workspace(t);
    await editStage(root, "first", (stage) => {
      const run = stage.steps.run;
      assert.ok(run);
      Reflect.set(run, field, "../missing.ts");
    });
    await assert.rejects(loadSources({ packageRoot: root }), (error) => {
      assert.ok(LoomError.is(error));
      assert.equal(error.code, "INVALID_LOOM");
      const diagnostics = (error.cause as { diagnostics: CompilerDiagnostic[] })
        .diagnostics;
      assert.ok(diagnostics[0]?.location?.line);
      assert.match(error.message, /Unrecognized/);
      return true;
    });
  });
}

test("collects independent document errors with source locations", async (t) => {
  const { root } = await workspace(t);
  await editManifest(root, (manifest) => {
    manifest.name = "BAD NAME";
    manifest.version = "invalid";
  });
  await assert.rejects(loadSources({ packageRoot: root }), (error) => {
    assert.ok(LoomError.is(error));
    const diagnostics = (error.cause as { diagnostics: CompilerDiagnostic[] })
      .diagnostics;
    assert.equal(diagnostics.length, 2);
    assert.notEqual(
      diagnostics[0]?.location?.line,
      diagnostics[1]?.location?.line,
    );
    return true;
  });
});

test("invalid references identify the declaring Step and field", async (t) => {
  const { root } = await workspace(t);
  await editStage(root, "first", (stage) => {
    const step = stage.steps.run;
    assert.ok(step?.type === "code");
    step.code = "../../outside.ts";
  });
  await assert.rejects(loadSources({ packageRoot: root }), (error) => {
    assert.ok(LoomError.is(error));
    assert.equal(error.code, "INVALID_REFERENCE");
    const at = (
      error.cause as {
        location: { file: string; line: number; stepName: string };
      }
    ).location;
    assert.equal(at.stepName, "run");
    assert.ok(at.line > 0);
    assert.equal(at.file, resolve(root, "stages/first.yaml"));
    return true;
  });
});

for (const resource of [
  "nested/template.txt",
  ".env",
  ".dev.vars",
  "link.txt",
] as const) {
  test(`Skill asset policy for ${resource}`, async (t) => {
    const { root } = await workspace(t);
    const path = resolve(root, "skills/review", resource);
    await mkdir(dirname(path), { recursive: true });
    if (resource === "link.txt")
      await symlink(resolve(root, "package.json"), path);
    else await writeFile(path, "fixture");
    if (resource !== "nested/template.txt") {
      await assert.rejects(
        loadSources({ packageRoot: root }),
        (e) => LoomError.is(e) && e.code === "INVALID_REFERENCE",
      );
    } else {
      const result = await loadSources({ packageRoot: root });
      const skill = result.resources.find((r) => r.kind === "skill");
      assert.ok(skill?.kind === "skill");
      assert.ok(
        skill.assets.some(
          (a) => a.outputPath === "skills/review/nested/template.txt",
        ),
      );
    }
  });
}
