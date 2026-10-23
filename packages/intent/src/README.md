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

`remove_project_file` requires a read receipt matching the file's current content, including for files just created by the Agent. Missing files and missing/stale reads return `saved: false` with `INTENT_FILE_NOT_FOUND` or `INTENT_FILE_READ_REQUIRED` and correction instructions, without changing files, State or evidence. The Agent may read the current file and submit a new explicit removal. Stage/task violations and host removal or persistence failures still throw; no mutation is automatically retried or converted into success.

Solution and Implementation preparation inherit evidence from their fixed upstream Records. The readable evidence collection preserves each receipt's ID, Run, original Stage, candidate and content; repeated preparation deduplicates identical receipts and rejects conflicting content under one ID. Validation continues that collection from its fixed Implementation Record. Inheritance makes a reference readable, not automatically applicable to another candidate or a passed verification. Reading unrelated history registers a historical Record receipt without adopting its nested evidence into the current collection.
