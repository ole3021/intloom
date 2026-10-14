---
title: From intent to validated delivery
---

# From intent to validated delivery

This example develops a local Todo application. Prepare Intent and your chosen execution environment first.

```text
Build a Todo app with local persistence.
Users can create, complete, rename, and delete tasks.
Keep the UI usable on narrow screens.
Propose the technical design and verification commands before changing files.
```

Submit this as one intent through your chosen interface. In CMD:

```sh
intloom flow intent --intent-file ./request.txt
```

## 1. Confirm requirements

Specification identifies goals, functions, scenarios, acceptance conditions, and unresolved questions. Answer actual questions about persistence, platforms, and expected behavior. Review the cumulative requirements; give concrete feedback if a requirement is missing. Confirm only the version you intend to approve.

## 2. Confirm the solution

Solution reads the confirmed Specification and project context. Review app structure, technology decisions, risks, affected scope, and build/test commands. Check that commands can run in your project's environment. Feedback returns to design; confirmation saves the Solution.

## 3. Inspect implementation

Implementation reads the fixed upstream bases, edits actual project files with declared Tools, and submits changes. Host Code runs the agreed checks and can return repair feedback. The resulting Record retains file origins/hashes and real command results.

## 4. Read validation

Validation independently assesses confirmed targets and actual delivery. Read evidence, command output, findings, and what remains unverified. Workflow completion does not imply every target passed.

Keep the same Run ID throughout. If observation disconnects, inspect that Run. If it fails, examine existing files and commits before starting new work. [Results](./results.md) explains which objects to read.
