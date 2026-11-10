import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

export function verifyReleaseAssets(tag, files, uploaded) {
  const expected = new Map(files.map((file) => [basename(file), file]));
  const problems = [];
  for (const { name, state, digest } of uploaded) {
    const file = expected.get(name);
    if (!file) {
      problems.push(`Unexpected attachment: ${name}`);
      continue;
    }
    expected.delete(name);
    if (state !== "uploaded") {
      problems.push(`Incomplete upload: ${name} (${state})`);
      continue;
    }
    const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
    if (digest !== `sha256:${hash}`) problems.push(`SHA-256 mismatch: ${name}`);
  }
  for (const name of expected.keys())
    problems.push(`Missing attachment: ${name}`);
  if (problems.length) throw new Error(`${tag}\n${problems.join("\n")}`);
}
