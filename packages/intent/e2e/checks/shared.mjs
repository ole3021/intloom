import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function digest(value) {
  const canonical = (v) =>
    Array.isArray(v)
      ? v.map(canonical)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, x]) => [k, canonical(x)]),
          )
        : v;
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}
export function indexed(context, kind) {
  const values = context.results[kind];
  const result = new Map(values.map((v) => [v.stageName, v]));
  assert.equal(result.size, values.length, `duplicate ${kind} stage`);
  return result;
}
export function approval(record, value = record.approval) {
  assert.ok(value?.reviewDigest, "approval must bind the reviewed content");
  const receipt = record.interactions.find(
    (i) => i.id === value.interactionRef,
  );
  assert.equal(receipt?.kind, "confirmation");
  assert.equal(receipt.answer.isConfirmed, true);
  assert.ok(!receipt.answer.feedback?.trim(), "feedback is not approval");
}
export async function main(url, check) {
  if (!process.argv[1] || pathToFileURL(process.argv[1]).href !== url) return;
  const context = JSON.parse(await readFile(process.argv[2], "utf8"));
  check(context);
  console.log(
    JSON.stringify({
      status: "passed",
      caseId: context.caseId,
      round: context.round.id,
      runId: context.run.runId,
    }),
  );
}
