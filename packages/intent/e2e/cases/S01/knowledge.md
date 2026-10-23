# User knowledge

## K01 — Scope
One local user, Node.js 26.4+ ESM, built-in libraries only. Tasks have independent IDs, nonblank trimmed titles and a completion flag. Duplicate titles are allowed. List every task in creation order, including completed tasks. A missing data file means an empty list. Completing an unknown task must report an error without changing data. No server, accounts, remote service, deployment or framework.

## K02 — Engineering choices
Choose reasonable command names, stable ID generation and a project-relative data filename. Preserve the existing package test command and workspace smoke check. Add focused Node tests covering the delivered behavior and actual command execution. The implementation and validation stages should both execute the relevant tests independently. No browser observation is required.

## K03 — Authority
Confirm requirements and designs consistent with K01–K02. Request correction if they add unsupported scope or omit stated behavior. This is a complete-delivery success case: partial delivery and ending collection with unverified targets are not authorized. If asked to choose those outcomes, report a knowledge/scenario block; do not invent consent. Do not perform implementation work as the simulated user. Test success requires the real four-stage results and independent case checks.
