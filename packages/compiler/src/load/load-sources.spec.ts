import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { describe, test, type TestContext } from "node:test";
import { LoomError } from "@intloom/utils";
import { loadSources } from "./load-sources.ts";

async function workspace(
  t: TestContext,
  files: Record<string, string>,
): Promise<string> {
  const root = await realpath(
    await mkdtemp(resolve(tmpdir(), "compiler-load-")),
  );
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) {
    const file = resolve(root, name);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, content);
  }
  return root;
}

describe("loadSources", () => {
  test("loads only referenced resources, deduplicates files and never executes source", async (t) => {
    const code = 'throw new Error("must not execute");';
    const root = await workspace(t, {
      "package.json": '{"name":"example"}',
      "workflow.yaml":
        'stage: "@stages/main"\ndescription: "@codes/not-present"\n',
      "stages/main.yaml":
        'code: "@codes/run"\nschema: "@schemas/state"\nagent: "@agents/reviewer"\nskills: ["@skills/review"]\ntools: ["@tools/search", "@tools/search:other"]\n',
      "codes/run.ts": code,
      "schemas/state.ts": code,
      "tools/search.ts": code,
      "agents/reviewer.md":
        "---\nname: reviewer\ndescription: review\n---\n\nPlease review.\n",
      "skills/review/SKILL.md":
        "---\nname: review\ndescription: review\n---\nSkill instructions\n",
      "stages/unreferenced.yaml": "invalid: [",
    });
    const result = await loadSources({
      packageRoot: resolve(root, "."),
      tsconfigFile: "custom.json",
    });
    assert.deepEqual(result.options, {
      packageRoot: root,
      tsconfigFile: "custom.json",
    });
    assert.deepEqual(result.packageJson.value, { name: "example" });
    assert.deepEqual(result.resources.map((item) => item.kind).sort(), [
      "agent",
      "code",
      "schema",
      "skill",
      "stage",
      "tool",
      "workflow",
    ]);
    const resource = result.resources.find((item) => item.kind === "code");
    assert.ok(resource && "source" in resource);
    assert.deepEqual(resource.source, {
      file: resolve(root, "codes/run.ts"),
      text: code,
    });
    const agent = result.resources.find((item) => item.kind === "agent");
    assert.ok(agent && "metadata" in agent);
    assert.equal(agent.content, "Please review.");
    assert.deepEqual(agent.metadata.value, {
      name: "reviewer",
      description: "review",
    });
  });

  for (const newline of ["\n", "\r\n"]) {
    test(`preserves YAML pointer and Markdown locations with ${JSON.stringify(newline)}`, async (t) => {
      const root = await workspace(t, {
        "package.json": "{}",
        "workflow.yaml": [
          '"a/b~c":',
          "  items:",
          "    - value",
          'agent: "@agents/reviewer"',
          "",
        ].join(newline),
        "agents/reviewer.md": [
          "\uFEFF---",
          "name: reviewer",
          "description: test",
          "---",
          "body",
        ].join(newline),
      });
      const { resources } = await loadSources({ packageRoot: root });
      const workflow = resources.find((item) => item.kind === "workflow");
      assert.ok(workflow && "document" in workflow);
      assert.deepEqual(workflow.document.locations["/a~1b~0c/items/0"], {
        file: resolve(root, "workflow.yaml"),
        line: 3,
        column: 7,
      });
      const agent = resources.find((item) => item.kind === "agent");
      assert.ok(agent && "metadata" in agent);
      assert.deepEqual(agent.metadata.locations["/name"], {
        file: resolve(root, "agents/reviewer.md"),
        line: 2,
        column: 1,
      });
    });
  }

  for (const [label, files, code] of [
    ["missing package", {}, "SOURCE_READ_FAILED"],
    ["invalid package JSON", { "package.json": "{" }, "SOURCE_PARSE_FAILED"],
    ["missing workflow", { "package.json": "{}" }, "SOURCE_READ_FAILED"],
    [
      "missing referenced file",
      { "package.json": "{}", "workflow.yaml": 'code: "@codes/missing"' },
      "SOURCE_READ_FAILED",
    ],
    [
      "missing frontmatter",
      {
        "package.json": "{}",
        "workflow.yaml": 'agent: "@agents/a"',
        "agents/a.md": "body only",
      },
      "SOURCE_PARSE_FAILED",
    ],
  ] satisfies [string, Record<string, string>, string][]) {
    test(`reports ${label}`, async (t) => {
      const root = await workspace(t, files);
      await assert.rejects(
        loadSources({ packageRoot: root }),
        (error) => LoomError.is(error) && error.code === code,
      );
    });
  }

  test("reports an invalid packageRoot", async (t) => {
    const root = await workspace(t, {});
    await assert.rejects(
      loadSources({ packageRoot: resolve(root, "missing") }),
      (error) => LoomError.is(error) && error.code === "SOURCE_READ_FAILED",
    );
  });

  test("rejects referenced symlinks outside the package", async (t) => {
    const root = await workspace(t, {
      "package/package.json": "{}",
      "package/workflow.yaml": 'code: "@codes/run"',
      "outside.ts": "export default 1;",
    });
    await mkdir(resolve(root, "package/codes"));
    await symlink(
      resolve(root, "outside.ts"),
      resolve(root, "package/codes/run.ts"),
    );
    await assert.rejects(
      loadSources({ packageRoot: resolve(root, "package") }),
      (error) => LoomError.is(error) && error.code === "INVALID_REFERENCE",
    );
  });

  test("invalid reference reports the referring YAML field", async (t) => {
    const root = await workspace(t, {
      "package.json": "{}",
      "workflow.yaml": 'name: example\ncode: "@codes/../outside"\n',
    });
    await assert.rejects(loadSources({ packageRoot: root }), (error) => {
      assert.ok(LoomError.is(error));
      assert.equal(error.code, "INVALID_REFERENCE");
      assert.deepEqual((error.cause as { location: unknown }).location, {
        file: resolve(root, "workflow.yaml"),
        line: 2,
        column: 1,
      });
      return true;
    });
  });
});
