import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../worker.mjs";
import { repositoryUrl } from "../src/site.ts";
import { studioTargets } from "../src/releases.ts";

const studio = "app-v2.0.0";
function release(tag, extra = {}) {
  return {
    tag_name: tag,
    draft: false,
    prerelease: false,
    html_url: `${repositoryUrl}/releases/tag/${encodeURIComponent(tag)}`,
    ...extra,
  };
}
const urlFor = (name) => `${repositoryUrl}/releases/download/${studio}/${name}`;
const assets = studioTargets.map(({ suffix }) => {
  const name = `IntLoom-Studio-2.0.0-${suffix}`;
  return { name, state: "uploaded", browser_download_url: urlFor(name) };
});
const request = (path, method = "GET") =>
  new Request("https://site.example" + path, { method });
test("all permanent Studio URLs redirect GET and HEAD to the published GitHub assets", async (t) => {
  const lookup = t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(
      url,
      "https://api.github.com/repos/ole3021/intloom/releases/latest",
    );
    return Response.json(release(studio, { assets }));
  });
  for (const { id, suffix } of studioTargets) {
    for (const method of ["GET", "HEAD"]) {
      const response = await worker.fetch(
        request("/download/studio/" + id, method),
        {},
      );
      assert.equal(response.status, 302);
      assert.equal(
        response.headers.get("location"),
        urlFor("IntLoom-Studio-2.0.0-" + suffix),
      );
      assert.equal(await response.text(), "");
    }
  }
  assert.equal(
    (await worker.fetch(request("/download/studio/unknown"), {})).status,
    404,
  );
  assert.equal(
    (await worker.fetch(request("/download/studio/linux-x64", "POST"), {}))
      .status,
    405,
  );
  assert.equal(lookup.mock.callCount(), 8);
});
test("release metadata picks the latest stable CLI on main across pages", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) => {
    if (url.endsWith("/latest"))
      return Response.json(release(studio, { assets }));
    if (url.includes("/compare/")) {
      const comparison = decodeURIComponent(new URL(url).pathname);
      assert.ok(comparison.endsWith("...main"));
      return Response.json({
        status: comparison.includes("@1.0.0...") ? "diverged" : "ahead",
      });
    }
    if (url.endsWith("page=1"))
      return Response.json(
        [
          release("framework-v99.0.0"),
          release("@intloom/cli@9.0.0", { draft: true }),
          release("@intloom/cli@8.0.0", { prerelease: true }),
          release("@intloom/cli@1.0.0"),
          release("@intloom/cli@0.9.0"),
        ],
        { headers: { link: '<next>; rel="next"' } },
      );
    return Response.json([release("@intloom/cli@0.10.0")]);
  });
  const response = await worker.fetch(request("/api/releases"), {});
  const metadata = await response.json();
  assert.equal(metadata.studio.version, "2.0.0");
  assert.deepEqual(
    metadata.studio.downloads,
    Object.fromEntries(
      studioTargets.map(({ id, suffix }) => [
        id,
        urlFor(`IntLoom-Studio-2.0.0-${suffix}`),
      ]),
    ),
  );
  assert.equal(metadata.cli.version, "0.10.0");
});
test("the CLI version is available before Studio has a latest release", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) => {
    if (url.endsWith("/latest")) return new Response(null, { status: 404 });
    if (url.includes("/compare/"))
      return Response.json({ status: "identical" });
    return Response.json([release("@intloom/cli@1.0.0")]);
  });
  const response = await worker.fetch(request("/api/releases"), {});
  assert.deepEqual(await response.json(), {
    cli: { version: "1.0.0", url: release("@intloom/cli@1.0.0").html_url },
  });
});
test("release failures and missing attachments do not redirect to an unverified URL", async (t) => {
  const responses = [
    new Response(null, { status: 503 }),
    Response.json(release(studio, { assets: [] })),
    Response.json(
      release(studio, {
        assets: assets.map((a) => ({
          ...a,
          browser_download_url: "https://other.example/asset",
        })),
      }),
    ),
  ];
  t.mock.method(globalThis, "fetch", async () => responses.shift());
  t.mock.method(console, "error", () => {});
  for (const status of [503, 404, 503]) {
    const result = await worker.fetch(
      request("/download/studio/linux-x64"),
      {},
    );
    assert.equal(result.status, status);
    assert.equal(result.headers.get("location"), null);
  }
  const page = await worker.fetch(request("/docs/"), {
    ASSETS: { fetch: () => new Response("docs") },
  });
  assert.equal(await page.text(), "docs");
});

test("a throttled REST endpoint still redirects using GitHub's public Latest page", async (t) => {
  const name = "IntLoom-Studio-2.0.0-linux-x64.tar.gz";
  t.mock.method(globalThis, "fetch", async (url, init) => {
    if (
      url.endsWith("/releases/latest") &&
      url.startsWith("https://api.github.com/")
    )
      return new Response(null, {
        status: 403,
        headers: { "x-ratelimit-remaining": "0" },
      });
    assert.equal(init.method, "HEAD");
    assert.equal(init.redirect, "manual");
    if (url.endsWith("/releases/latest"))
      return Response.redirect(repositoryUrl + "/releases/tag/" + studio, 302);
    assert.equal(url, urlFor(name));
    return Response.redirect(
      "https://release-assets.githubusercontent.com/download",
      302,
    );
  });
  const result = await worker.fetch(request("/download/studio/linux-x64"), {});
  assert.equal(result.status, 302);
  assert.equal(result.headers.get("location"), urlFor(name));
  assert.equal(await result.text(), "");
});
