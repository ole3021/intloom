import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  cliReleasesUrl,
  studioReleasesUrl,
  studioTargets,
} from "../src/releases.ts";

export function verifyCliRelease(html) {
  for (const marker of [
    "<code>npm install -g intloom</code>",
    `href="${cliReleasesUrl}"`,
    `href="${studioReleasesUrl}"`,
    ...studioTargets.map(({ id }) => `href="/download/studio/${id}"`),
  ])
    assert.ok(html.includes(marker), `Homepage is missing ${marker}`);
  assert.doesNotMatch(html, /npm install -g intloom@/);
}
if (import.meta.main) verifyCliRelease(readFileSync(process.argv[2], "utf8"));
