import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { verifyReleaseAssets } from "../../.github/scripts/verify-release-assets.mjs";

test("release verification reports missing, unexpected, incomplete and corrupt attachments by name", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "intloom-release-assets-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const names = ["installer.dmg", "installer.sha256", "update.json"];
  const files = names.map((name) => join(root, name));
  const uploaded = [];
  for (const name of names) {
    await writeFile(join(root, name), name);
    const hash = createHash("sha256").update(name).digest("hex");
    uploaded.push({ name, state: "uploaded", digest: `sha256:${hash}` });
  }
  verifyReleaseAssets("tag", files, uploaded);
  assert.throws(
    () =>
      verifyReleaseAssets("tag", files, [
        { ...uploaded[0], digest: "sha256:other" },
        { ...uploaded[1], state: "starter" },
        { ...uploaded[2], name: "extra.zip" },
      ]),
    {
      message:
        "tag\nSHA-256 mismatch: installer.dmg\nIncomplete upload: installer.sha256 (starter)\nUnexpected attachment: extra.zip\nMissing attachment: update.json",
    },
  );
});
