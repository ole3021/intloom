---
name: specification-analysis
description: Analyze the original Intent against the committed specification baseline and produce cumulative Changes that preserve provenance and acceptance meaning.
---

# Requirements and cumulative changes

Read State through read_specification. baseline.data is this Run's baseline. When baseline=null, all six collections are empty: domains, features, requirements, constraints, relations, and deferreds. changes always describes the complete cumulative change relative to this baseline; do not append the same patches again to the previous draft result.

## Data shape

All objects reject extra fields, and descriptions must contain non-whitespace text. Omit optional fields when absent; use [] for empty collections. All objects except Acceptance have status set to active or retired.

| Collection / object | Complete fields |
| --- | --- |
| domains / Domain | id: SDOM-*, responsibility, status |
| features / Feature | id: SFEA-*, responsibility, status, domain_ref |
| requirements / Requirement | id: SREQ-*, description, status, feature_ref, acceptances: Acceptance[], record_refs: RUN-*[] |
| Acceptance | id: SACC-*, requirement_ref, description; stored in its parent Requirement.acceptances |
| constraints / Constraint | id: SCON-*, description, status, record_refs |
| relations / Relation | id: SREL-*, source_req_ref, target_req_ref, type, description, status, record_refs |
| deferreds / Deferred | id: SDEF-*, question, description, impact?, impact_refs: (SFEA-* / SREQ-* / SCON-*)[], status, record_refs |

Relation.type is depends_on, conflicts_with, or refines. source depends_on target means the source depends on the target; source refines target means the source refines the target. State conflict conditions explicitly without implying precedence. Self-relations are forbidden. Active objects must reference existing active objects, and acceptance ownership must match the parent Requirement.

Keep existing object IDs. New objects use the appropriate prefix and a new unique suffix; never reuse historical IDs. New objects have record_refs=[], maintained automatically by Finalize. Do not insert this Run's ID yourself.

## Changes and JSON Patch

Each Change is {target_ref, reason, patch}. reason explains the requirement basis and impact; patch must be nonempty and produce an actual change. Apply Changes in order. Patch path is a JSON Pointer relative to the target object. Only test, add, replace, and remove are supported.

- New object: add at the empty path with the complete object as value; its id must equal target_ref.
- Modify an existing field: test the old value at the same path, immediately followed by replace with the new value.
- Remove an optional field: test the old value at the same path, immediately followed by remove.
- Add a field: use add; the field must be absent, and existing values cannot be overwritten.
- Ordinary reference arrays: test and replace the whole field; do not modify by array index.
- Do not modify id or record_refs. Existing root objects cannot be replaced or removed as a whole; retire them through status.
- Existing Requirement.acceptances cannot be replaced as a whole or modified by index. Add, modify, or remove an Acceptance using its own target_ref; its parent Requirement must exist and be active. To remove an acceptance, test the complete object at the empty path, then remove at the empty path.
- A new Requirement may include new acceptances. Create parents before objects that depend on them.

Example: revise a requirement description to reflect the user's explicit request:

```json
{"target_ref":"SREQ-example","reason":"The user supplied an acceptance criterion","patch":[{"op":"test","path":"/description","value":"Original description"},{"op":"replace","path":"/description","value":"New description confirmed by the user"}]}
```

Describe behavior as verifiable conditions and results. Do not present implementation choices, industry conventions, or recommendations as user-confirmed requirements. Use the clarification Skill when facts are missing. When Check detects a baseline change, it refreshes baseline and appends diagnostics; reread State and rebuild cumulative Changes without bypassing failed old-value tests.
