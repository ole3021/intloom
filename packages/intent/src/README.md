# Shared Intent code

This directory contains logic shared by Intent stages. The generic host contract belongs to `@intloom/loom-sdk`; feature-development rules remain in this package.

- `schema/`: shared references, interaction receipts, evidence and verification contracts.
- `edits.ts`: atomic draft edits and Code-owned temporary-reference allocation.
- `storage.ts`: immutable same-Run inputs, content digests and atomic Record/Artifact publication.
- `interaction.ts`, `questions.ts`: actual user replies, revision-bound confirmation and recovery.
- `project.ts`, `verification.ts`: candidate identity, actual changes, command receipts and procedure observations.
- `targets.ts`: immutable target projections from confirmed requirement/design Records.
- `tools/`: capability-limited project, evidence, history and clarification operations.
- `state.ts`, `initialize.ts`, `json.ts`, `errors.ts`, `access.ts`: small boundary helpers.

Stage-specific schemas, rules, actions and routing belong under `stages/<stage>/`. Agent and Skill text describe role and method; they do not serialize formal results or implement the state machine.
