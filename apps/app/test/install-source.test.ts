import assert from "node:assert/strict";
import test from "node:test";
import { resolveInstallSource } from "../src/main/install-source.ts";
import { mockInstallPreview } from "../src/mock/install.ts";

test("npm names and package pages preserve scopes and explicit versions", async () => {
  for (const [input, spec] of [
    ["  demo-loom  ", "demo-loom"],
    ["@group/demo@next", "@group/demo@next"],
    ["demo-loom@^1.2.0", "demo-loom@^1.2.0"],
    ["https://npmjs.com/package/@group%2fdemo", "@group/demo"],
    [
      "https://www.npmjs.com/package/@group/demo/v/1.2.0?activeTab=readme",
      "@group/demo@1.2.0",
    ],
  ]) {
    assert.deepEqual(await resolveInstallSource(input), [
      { kind: "npm", spec, label: "npm" },
    ]);
  }
  for (const input of [
    "--global",
    "git+ssh://git@github.com/org/repo",
    "https://github.com/org/repo/tree/main",
    "https://example.org/pkg.tgz",
    "https://github.com@evil.test/org/repo",
    "https://www.npmjs.com/search?q=demo",
  ])
    await assert.rejects(resolveInstallSource(input));
});

test("repository, tag and asset links resolve to specific Release tarballs", async () => {
  const base = "https://github.com/org/looms";
  const asset = (name: string) => ({
    name,
    state: "uploaded",
    browser_download_url: base + "/releases/download/v1/" + name,
  });
  const urls: string[] = [];
  const get = async (url: string) => {
    urls.push(url);
    return Response.json({
      tag_name: "v1",
      assets: [asset("one.tgz"), asset("two.tgz"), asset("source.zip")],
    });
  };
  for (const source of [
    base,
    base + ".git/",
    base + "/releases/latest",
    base + "/releases/tag/v1",
  ]) {
    const result = await resolveInstallSource(source, get);
    assert.deepEqual(
      result.map((p) => p.spec),
      ["one.tgz", "two.tgz"].map((n) => asset(n).browser_download_url),
    );
  }
  assert.deepEqual(
    urls.map((u) => u.split("/releases/")[1]),
    ["latest", "latest", "latest", "tags/v1"],
  );
  const [latest] = await resolveInstallSource(
    base + "/releases/latest/download/one.tgz",
    get,
  );
  assert.deepEqual(
    await resolveInstallSource(latest.spec, () => {
      throw Error("unexpected request");
    }),
    [latest],
  );
  await assert.rejects(
    resolveInstallSource(base, async () =>
      Response.json({ tag_name: "v1", assets: [] }),
    ),
    /尚未提供/,
  );
  await assert.rejects(
    resolveInstallSource(base, async () => new Response("", { status: 403 })),
    /403/,
  );
  await assert.rejects(
    resolveInstallSource(base, async () => {
      throw Error("offline");
    }),
    /网络/,
  );
});

test("mock rehearsals can preview an uninstalled package and reopen an installed one", () => {
  const [pkg] = mockInstallPreview(
    "https://github.com/example/report-writer",
    [],
  );
  assert.equal(pkg.spec, "report-writer");
  assert.equal(pkg.installed, undefined);
  assert.equal(
    mockInstallPreview("https://www.npmjs.com/package/report-writer", [
      pkg.id,
    ])[0].installed,
    "same",
  );
});
