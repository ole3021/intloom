import assert from "node:assert/strict";
import { test } from "node:test";
import { confirmationArtifact } from "../../test/confirmation-fixture.ts";
import { emptyArtifact } from "./changes.ts";
import { formatConfirmation } from "./format-confirmation.ts";

test("confirmation presents the complete candidate, references and retirement without persistence metadata", () => {
  const artifact = confirmationArtifact();
  const original = structuredClone(artifact);
  const text = formatConfirmation(artifact);
  for (const content of [
    "Specification ready to save",
    "Task management",
    "Domain: Task management",
    "Feature: Browser task operations",
    "Enter adds a task and clears the input.",
    "Blank titles are not added.",
    "Duplicate titles retain separate identities.",
    "Acceptance criteria: Not defined",
    "Use only localStorage without a server connection.",
    "Account login is required. (retired)",
    "Restore previously added tasks.",
    "Relation: Reload restores tasks. depends on Enter adds a task and clears the input.",
    "Which theme should be used?",
    "Description: The theme remains undecided for the first release.",
    "Impact: Affects visual design without blocking task operations.",
    "Related items: Browser task operations; Enter adds a task and clears the input.; Use only localStorage without a server connection.",
  ])
    assert.ok(
      text.includes(content),
      `Missing confirmation content: ${content}`,
    );
  assert.doesNotMatch(
    text,
    /record_refs|RUN-history|SDOM-|SFEA-|SREQ-|undefined/,
  );
  assert.deepEqual(artifact, original);
});

test("confirmation keeps long and multiline content and renders all relation meanings", () => {
  const artifact = confirmationArtifact();
  const long = "Complete acceptance criterion".repeat(100);
  const acceptance = artifact.requirements[0]?.acceptances[0];
  const relation = artifact.relations[0];
  const deferred = artifact.deferreds[0];
  assert.ok(acceptance && relation && deferred);
  acceptance.description = `${long}\nSecond line of the criterion`;
  relation.type = "conflicts_with";
  deferred.impact_refs = [];
  delete deferred.impact;
  const conflict = formatConfirmation(artifact);
  assert.ok(conflict.includes(long));
  assert.match(conflict, /\n {3}Second line of the criterion/);
  assert.match(
    conflict,
    /Reload restores tasks. conflicts with Enter adds a task and clears the input./,
  );
  assert.doesNotMatch(conflict, /Impact: |Related items: /);
  relation.type = "refines";
  assert.match(
    formatConfirmation(artifact),
    /Reload restores tasks. refines Enter adds a task and clears the input./,
  );
});

test("empty candidate is explicit and does not show empty collections", () => {
  const text = formatConfirmation(emptyArtifact());
  assert.match(text, /There are no specification items./);
  assert.doesNotMatch(
    text,
    /\nDomains\n|\nFeatures\n|\nRequirements\n|\nConstraints\n|Requirement relations|Deferred items/,
  );
});
