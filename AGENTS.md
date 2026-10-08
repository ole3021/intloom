# IntLoom Development Principles

## Work from confirmed intent

- The user's current, explicit instruction takes priority.
- Find the current authoritative source before changing behavior. Do not treat
  a proposal, example, report, historical material, or uncommitted code as a
  confirmed requirement.
- When a change would alter an architectural decision, public contract, or
  agreed scope, explain the concrete trade-offs and obtain confirmation first.
- Within a confirmed boundary, make the smallest complete change that solves
  the problem. Do not add abstractions, dependencies, or scope for a
  hypothetical future need.

## Keep one source of truth

- Architecture, responsibilities, interfaces, build behavior, release rules,
  and verification requirements belong to their current owners: design
  documents, source contracts, package documentation, scripts, and CI.
- Read the relevant current owner for the task. Do not duplicate or maintain
  those details in this file.
- When an approved change affects a contract, synchronize its real consumers:
  implementation, tests, documentation, declarations, and automation as
  applicable.

## Preserve evidence and boundaries

- Validate work with the current package scripts and CI expectations. Report
  what actually ran, what it proves, and what remains unverified.
- Do not present cached work, type checks, examples, local archives, or partial
  tests as evidence of complete runtime, consumer, or publication behavior.
- Use Bun for the development toolchain. Production code and tests must remain
  compatible with their supported Node.js runtime.
- Keep secrets out of source, generated artifacts, logs, and browser builds.

## Respect the workspace

- Protect unrelated user changes. Do not delete, overwrite, commit, push, or
  publish work unless the user explicitly asks.
- Prefer direct, readable changes and existing local patterns. Keep comments
  focused on semantics that code and types cannot express.
