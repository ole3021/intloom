# User knowledge

## K01 — Team and applications
A local service team uses three application modules: intake, scheduling and reporting. One CLI may expose them. Requests have ID, title, customer reference and status. Assignments link a request to an operator and a scheduled date. Reports aggregate counts and assignments without modifying business data.

## K02 — Shared lifecycle
Preserve the shared status values draft, queued, scheduled, completed and cancelled. Intake creates queued requests after checking nonblank titles and customer references. Scheduling accepts queued requests and changes them to scheduled. Completion accepts scheduled requests. Cancellation is allowed before completion. You may decide how CLI subcommands express these operations.

## K03 — Persistence and boundaries
Use one project-relative JSON store with separate request and assignment collections. Perform each operation consistently; reject a failure without partially updating collections. Scheduling does not edit customer data. Reports are read-only. Multiple concurrent processes, billing, email, external calendars and remote services are deferred.

## K04 — Existing workspace
The starting project has no prepared business workspace. Create apps/intake, apps/scheduling, apps/reporting and shared contracts/domain/persistence modules progressively when their responsibilities become active. Preserve exports introduced by previous intents. When operator registration is needed, local operator IDs operator-a and operator-b with display names Alex and Blake are authorized; an initially empty assignment collection is valid. Add code and Node tests across relevant modules; do not collapse the entire workspace into one implementation file.

## K05 — Engineering environment
Use Node.js 26.4.0+ ESM and built-in libraries only. Create a package test script and focused contract checks, then preserve tests introduced by earlier intents. The host test command may use node with args ["--test", "test/*.test.mjs"]. Business checks must terminate. No publication, deployment or network access is needed.

## K06 — Confirmation authority
You may confirm drafts consistent with K01–K05 and choose local IDs, paths and CLI syntax. Request changes if a draft merges module responsibilities or adds external integrations. Unknown decisions outside these permissions should be reported as missing knowledge. The delivered software's quality is assessed separately from this functional E2E.

## K07 — Iterative reporting and queries
Features become active only when introduced by the current Intent. Status filters accept the shared status values, omitted filters preserve creation order, and unknown filters fail. Operator reports include registered operators with zero assignments and count scheduled/completed assignments. JSON export uses schemaVersion 1, request and assignment arrays in creation order, and stdout. All reports and exports are read-only. Keep one store and document delivered commands; no web UI or external integration is needed.
