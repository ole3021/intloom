import assert from "node:assert/strict";
import { test } from "node:test";
import { publications, type PackageManifest } from "./publication.ts";
import {
  assertDeliveryVersion,
  assertReleaseManifest,
  archiveName,
  selectPublications,
  selectChangedPublications,
  releaseNotes,
  draftReleaseNote,
  type PublicationVersions,
  type ReleaseManifest,
} from "./release.ts";
import {
  compareVersions,
  validateRelease,
  validateVersion,
} from "./version.ts";

test("release versions enforce stable/prerelease ordering and the main-branch gate", () => {
  const ordered = [
    "1.0.0-alpha",
    "1.0.0-alpha.2",
    "1.0.0-alpha.10",
    "1.0.0-beta",
    "1.0.0",
    "1.0.1",
  ];
  for (const [index, version] of ordered.entries()) {
    assert.equal(compareVersions(version, version), 0);
    for (const later of ordered.slice(index + 1)) {
      assert.equal(compareVersions(version, later), -1);
      assert.equal(compareVersions(later, version), 1);
    }
  }
  for (const invalid of [
    "01.0.0",
    "1.0",
    "1.0.0-01",
    "1.0.0+build",
    "9007199254740992.0.0",
  ])
    assert.throws(() => validateVersion(invalid), /Invalid release version/);
  validateRelease("1.0.0", "latest", "refs/heads/main");
  validateRelease("1.0.0-rc.1", "next", "refs/heads/main");
  for (const args of [
    ["0.0.0", "latest", "refs/heads/main"],
    ["1.0.0", "latest", "refs/heads/feat-test"],
    ["1.0.0-rc.1", "latest", "refs/heads/main"],
  ] as const)
    assert.throws(() => validateRelease(args[0], args[1], args[2]));
});

test("delivery metadata and resolved workspace versions require a version increase", () => {
  const before: PackageManifest = {
    name: "@intloom/cli",
    version: "1.0.0",
    dependencies: { "@intloom/loom-sdk": "workspace:*" },
  };
  for (const change of [
    { engines: { node: ">=27" } },
    { exports: { ".": "./other.js" } },
    { dependencies: { zod: "5.0.0" } },
    { peerDependencies: { zod: "5.0.0" } },
    { optionalDependencies: { zod: "5.0.0" } },
  ])
    assert.throws(
      () => assertDeliveryVersion({ ...before, ...change }, before),
      /without a version increase/,
    );
  assert.throws(
    () =>
      assertDeliveryVersion(
        before,
        before,
        { "@intloom/loom-sdk": "1.1.0" },
        { "@intloom/loom-sdk": "1.0.0" },
      ),
    /dependencies/,
  );
  assertDeliveryVersion(
    { ...before, scripts: { test: "changed" }, devDependencies: { tool: "2" } },
    before,
  );
  assertDeliveryVersion(
    { ...before, version: "1.1.0", engines: { node: ">=27" } },
    before,
  );
  assert.throws(
    () => assertDeliveryVersion({ ...before, version: "0.9.0" }, before),
    /must increase/,
  );
  const kernel = { name: "@intloom/kernel", version: "1.0.0" };
  assert.throws(
    () =>
      assertDeliveryVersion({ ...kernel, engines: { node: ">=27" } }, kernel),
    /kernel and @intloom\/cli together/,
  );
});

test("release selection and archive identity keep CLI and its launcher together", () => {
  const versions = Object.fromEntries(
    publications.map(({ name }) => [name, "1.0.0"]),
  ) as PublicationVersions;
  assert.deepEqual(selectPublications(["intloom"]), [
    "@intloom/cli",
    "intloom",
  ]);
  assert.deepEqual(
    selectChangedPublications(
      { ...versions, "@intloom/cli": "1.1.0", intloom: "1.1.0" },
      versions,
    ),
    ["@intloom/cli", "intloom"],
  );
  assert.throws(
    () => selectPublications(["@intloom/kernel"]),
    /Unknown public package/,
  );
  const name = "@intloom/utils";
  const manifest: ReleaseManifest = {
    commit: "local",
    versions,
    selected: [name],
    entries: [
      {
        name,
        version: "1.0.0",
        tag: "latest",
        file: archiveName(name, "1.0.0"),
        integrity: `sha512-${"A".repeat(86)}==`,
        dependencies: {},
      },
    ],
  };
  assertReleaseManifest(manifest);
  const entry = manifest.entries[0];
  assert.ok(entry);
  for (const change of [
    { version: "1.1.0" },
    { file: "other.tgz" },
    { integrity: "invalid" },
    { tag: "next" as const },
  ])
    assert.throws(() =>
      assertReleaseManifest({
        ...manifest,
        entries: [{ ...entry, ...change }],
      }),
    );
  assert.throws(
    () =>
      releaseNotes(
        `## @intloom/cli@1.0.0\n${draftReleaseNote}`,
        "intloom",
        "1.0.0",
      ),
    /reviewed changelog/,
  );
  assert.equal(
    releaseNotes(
      "## @intloom/cli@1.0.0\nFixed status.\n\n## older\nOther",
      "intloom",
      "1.0.0",
    ),
    "Fixed status.",
  );
});
