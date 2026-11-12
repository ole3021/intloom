import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  cliReleasesUrl,
  latestReleaseUrl,
  studioTargets,
} from "../src/releases.ts";

export function verifyCliRelease(html) {
  for (const marker of [
    "<code>npx intloom startup</code>",
    "<code>npm install -g intloom</code>",
    `href="${cliReleasesUrl}"`,
    ...studioTargets.map(({ id }) => `href="/download/studio/${id}"`),
  ])
    assert.ok(html.includes(marker), `Homepage is missing ${marker}`);
  const notes = [...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].find(([link]) =>
    link.includes(">Release notes<"),
  );
  assert.ok(notes?.[0].includes(`href="${latestReleaseUrl}"`));
  assert.doesNotMatch(html, /npm install -g intloom@/);
}
if (import.meta.main) verifyCliRelease(readFileSync(process.argv[2], "utf8"));
