# User knowledge

## K01 — Users and scope
One person runs this application locally. Tasks have an ID, a title and a completion flag. Listing defaults to all tasks. Completed tasks remain visible. No accounts, collaboration, synchronization or external service is required.

## K02 — Persistence and decisions
Use a JSON file under a project-relative data directory. An empty file store means an empty task list. Preserve task IDs after reopening. Titles must be nonblank. You may choose UUIDs or monotonically increasing local IDs and may pick sensible CLI command names. Duplicate titles are allowed.

## K03 — Engineering environment
Use Node.js 26.4.0+ ESM and built-in libraries only. Add implementation and focused Node tests. Preserve the package's test script and existing workspace smoke test. The agreed test command may be node with args ["--test", "test/*.test.mjs"]. Do not deploy, publish or make network calls from the business application.

## K04 — Confirmation authority
You may confirm requirements and a solution consistent with K01–K03. If a draft adds remote storage, accounts or dependencies, request removal. Appearance, advanced task search and bulk actions are deferred. This E2E evaluates IntLoom functionality; a later evaluator may grade the task application itself.
