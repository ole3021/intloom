import assert from "node:assert/strict";
import { createServer as createRegistry } from "node:http";
import { createHash } from "node:crypto";
import { readFile, appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

export async function verifyInstallSources(
  app,
  archive,
  olderArchive,
  ordinaryArchive,
  meetingNotes,
  verifyRun,
) {
  const archiveBytes = await readFile(archive);
  const github = "https://github.com/intloom-test/looms";
  const releasePath = "/intloom-test/looms/releases/download/v0.4.0/";
  const assets = new Map([
    ["file-report.tgz", archiveBytes],
    ["ordinary.tgz", await readFile(ordinaryArchive)],
    ["meeting-notes.tgz", await readFile(meetingNotes)],
  ]);
  const meeting = JSON.parse(
    await readFile(
      new URL("../../../examples/meeting-notes/package.json", import.meta.url),
      "utf8",
    ),
  );
  const registryPackages = new Map([
    ["file-report", { version: "0.4.0", file: "file-report.tgz" }],
    [meeting.name, { version: meeting.version, file: "meeting-notes.tgz" }],
  ]);
  const registry = createRegistry((req, res) => {
    const name = decodeURIComponent(req.url.slice(1));
    const pkg = registryPackages.get(name);
    if (pkg) {
      const manifest = {
        name,
        version: pkg.version,
        dist: {
          tarball: process.env.npm_config_registry + pkg.file,
          integrity:
            "sha512-" +
            createHash("sha512").update(assets.get(pkg.file)).digest("base64"),
        },
      };
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          name,
          "dist-tags": { latest: pkg.version },
          versions: { [pkg.version]: manifest },
        }),
      );
    } else if (assets.has(name)) {
      res.end(assets.get(name));
    } else if (
      req.url.startsWith(releasePath) &&
      assets.has(req.url.slice(releasePath.length))
    ) {
      res.end(assets.get(req.url.slice(releasePath.length)));
    } else {
      res.writeHead(404).end();
    }
  }).listen(0, "127.0.0.1");
  await new Promise((resolve) => registry.once("listening", resolve));
  const originalRegistry = process.env.npm_config_registry;
  process.env.npm_config_registry = `http://127.0.0.1:${registry.address().port}/`;
  try {
    const [local] = await app.previewLoom(archive);
    assert.equal(local.id, "file-report");
    assert.equal(local.installed, undefined);
    for (const source of [
      "file-report",
      "file-report@0.4.0",
      "https://www.npmjs.com/package/file-report/v/0.4.0",
    ]) {
      const [preview] = await app.previewLoom(source);
      assert.equal(preview.spec, "file-report@0.4.0");
      assert.equal(preview.integrity, local.integrity);
      await app.act({
        type: "catalog",
        id: preview.spec,
        install: true,
        integrity: preview.integrity,
      });
      assert.equal((await app.previewLoom(archive))[0].installed, "same");
      assert.equal(
        (await app.snapshot()).catalog[0].ref.artifactDigest,
        local.artifactDigest,
      );
      if (source === "file-report") await verifyRun("Installed from npm");
      await app.act({ type: "catalog", id: local.id, install: false });
    }
    const [notes] = await app.previewLoom(meeting.name);
    assert.equal(notes.spec, `${meeting.name}@${meeting.version}`);
    await app.act({
      type: "catalog",
      id: notes.spec,
      install: true,
      integrity: notes.integrity,
    });
    assert.equal(
      (await app.snapshot()).catalog.find((p) => p.ref.id === meeting.name)
        ?.defaultCommand,
      "summarize",
    );
    await app.act({ type: "catalog", id: meeting.name, install: false });
    const fetchRelease = globalThis.fetch;
    const nodeOptions = process.env.NODE_OPTIONS;
    try {
      const preload = fileURLToPath(
        new URL("./fixtures/github-release.cjs", import.meta.url),
      );
      process.env.NODE_OPTIONS =
        `${nodeOptions ?? ""} --require=${JSON.stringify(preload)}`.trim();
      globalThis.fetch = async (url, options) =>
        String(url).startsWith(
          "https://api.github.com/repos/intloom-test/looms/releases/",
        )
          ? Response.json({
              tag_name: "v0.4.0",
              assets: [...assets.keys()].map((name) => ({
                name,
                state: "uploaded",
                browser_download_url: `${github}/releases/download/v0.4.0/${name}`,
              })),
            })
          : fetchRelease(url, options);
      await assert.rejects(
        app.previewLoom(github + "/releases/download/v0.4.0/ordinary.tgz"),
        /可安装的 Loom/,
      );
      for (const source of [
        github,
        github + "/releases/tag/v0.4.0",
        github + "/releases/download/v0.4.0/file-report.tgz",
      ]) {
        const candidates = await app.previewLoom(source);
        assert.equal(candidates.length, source.endsWith(".tgz") ? 1 : 2);
        const selected = candidates.find((p) => p.id === local.id);
        assert.equal(selected.integrity, local.integrity);
        await app.act({
          type: "catalog",
          id: selected.spec,
          install: true,
          integrity: selected.integrity,
        });
        assert.equal(
          (await app.snapshot()).catalog[0].ref.artifactDigest,
          local.artifactDigest,
        );
        if (source === github) await verifyRun("Installed from GitHub");
        await app.act({ type: "catalog", id: local.id, install: false });
      }
    } finally {
      globalThis.fetch = fetchRelease;
      if (nodeOptions === undefined) delete process.env.NODE_OPTIONS;
      else process.env.NODE_OPTIONS = nodeOptions;
    }
    await assert.rejects(
      app.act({
        type: "catalog",
        id: archive,
        install: true,
        integrity: "stale",
      }),
      /包内容已经变化/,
    );
    assert.equal((await app.snapshot()).installed.length, 0);
    const [older] = await app.previewLoom(olderArchive);
    await app.act({
      type: "catalog",
      id: older.spec,
      install: true,
      integrity: older.integrity,
    });
    const [upgrade] = await app.previewLoom(archive);
    assert.equal(upgrade.installedVersion, older.version);
    assert.equal(upgrade.installed, "changed");
    await app.act({
      type: "catalog",
      id: upgrade.spec,
      install: true,
      integrity: upgrade.integrity,
    });
    const installedRoot = (await app.snapshot()).connection.npmRoot;
    const yaml = join(installedRoot, local.id, "loom.yaml");
    await appendFile(yaml, "\n# previous build\n");
    const [replacement] = await app.previewLoom(archive);
    assert.equal(replacement.installedVersion, local.version);
    assert.equal(replacement.installed, "changed");
    await app.act({
      type: "catalog",
      id: replacement.spec,
      install: true,
      integrity: replacement.integrity,
    });
    assert.equal((await app.previewLoom(archive))[0].installed, "same");
    console.log(
      "GitHub and npm fixture sources, pinned archives, version upgrade and same-version replacement passed.",
    );
  } finally {
    registry.close();
    if (originalRegistry === undefined) delete process.env.npm_config_registry;
    else process.env.npm_config_registry = originalRegistry;
  }
}
