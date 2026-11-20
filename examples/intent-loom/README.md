# Intent Loom

A 0.5 multi-stage Workflow: capture a project baseline, review requirements, review a solution, implement a candidate, then independently validate it. Each review is a nested Workflow inside a bounded `repeat` (at most five drafts). Four structured Agents have packaged instructions; the auditor declares a standard Agent Skill with a reference resource.

From the example's source directory, run `bun run typecheck` and `bun run build`. Archive the standalone `dist/` with `npm pack`.

## Input

Use standard Loom input with a change request, one configuration file, and one project folder, all paths complete in the execution environment:

```json
{
  "prompt": "Fix greet(name) to return Hello, <name>! and preserve Unicode names.",
  "files": ["/absolute/path/to/samples/request.json"],
  "folders": ["/absolute/path/to/samples/project"]
}
```

The JSON configuration declares `files: [{path, editable}]` and `checks: [{id, description, command, args}]`. See `samples/request.json`. Files are relative, non-hidden regular UTF-8 project files. Missing editable files can be created; protected files must exist. Duplicate paths/check IDs and the reserved `protected-files` check ID are rejected. A candidate can replace or delete only declared editable paths. The original project is read as a baseline.

## Review and evidence

`user.ask` presents a plain-text question and explanation with single-choice approve/revise/end feedback. Revision uses the same tool's text mode with a nonblank answer schema. Invalid feedback stays in the same interaction; it does not consume a draft round. Deferral keeps the call waiting. Ending calls `context.reject` from the Loom. Drafts and decisions are saved under `revisions/`; approved requirements and solution are separate JSON files.

Cross-stage state carries complete baseline, draft, specification, solution and candidate snapshot paths plus small review fields. Each stage reads the snapshots it needs; candidate files are retained in `implementation.json` without duplicating the baseline. Keep these files together at their bound locations during execution.

Implementation and validation each execute the supplied trusted commands through `context.process.run`, each in a fresh `withTempDir` directory. Commands have a 30-second timeout and 16,000-byte combined output cap, with explicit truncation and strict UTF-8 validation. The Kernel binding supplies the environment, cancellation and cleanup. Protected files have a separate SHA-256 check.

Validation uses the same fixed candidate and fresh command receipts. A nonzero completed check overrides a passing model opinion; launch failures, timeouts, signals or missing evidence yield `unverified`. The final acceptance is rejected unless all criteria and both command suites pass. The Loom writes every declared output before rejecting a failed assessment with `context.reject`, allowing rejected execution with complete evidence.

## Outputs and verification

`summary.md`, six JSON evidence files, and the `revisions/` folder are declared in `loom.yaml`. `implementation.json` includes all candidate file contents, deletions, digest and implementation receipts. To reproduce it in a new empty directory, import `materialize` from the built package's `src/project.js`, call `materialize(directory, candidate.files, context.fs)`, then run its declared checks.

The current CLI builds/checks definitions. The archive-consumer suite drives the definitions with a small test-only interpreter, real Kernel tool scopes, and scripted Agent/user responses. It runs real Node verification commands for small, medium and large sample projects, exercises revisions and failure evidence, and checks declared outputs. It does not implement Kernel lifecycle, persistence, authorization or live model execution.
