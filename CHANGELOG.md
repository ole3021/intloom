# Changelog

## Unreleased

- Separate unit, business integration and prepared-archive consumer tests with one `bun run verify` entry; cover the complete Intent Workflow and repair after a real failed host check.
- Retry npm publication visibility before consumer verification, and distinguish unavailable versions from actual archive integrity conflicts.
- Reserve CLI start/stop for service lifecycle and use flow, cancelRun, and cancelAllRuns for Kernel/Runtime execution.
- Standardize RunView.cursor across CLI/MCP, query and answer names, and Workflow initialization diagnostic types.
- Deprecate Query and SnapshotCategory in favor of StorageQuery and StorageCategory; retain compatibility aliases.

## @intloom/cli@0.0.6

- Distinguish incompatible Service APIs, invalid responses, HTTP availability errors, and timeouts while retaining unknown outcomes for transmitted writes without a valid receipt.
- Record model request, Tool execution, and Agent execution durations with bounded diagnostics and remove repeated successful Run query logging.
- Align the CLI, launcher, and bundled Kernel with the updated public dependencies; require a reviewed baseline and version increases for changed consumer delivery metadata during release preparation.

## @intloom/workflow-intent@0.0.4

- Use the updated public Workflow SDK and Utils releases while retaining the 2026-10-08 Workflow protocol and existing Intent execution behavior.

## @intloom/compiler@0.0.3

- Require Node.js 26.4.0+ and use the Node.js 26 declaration baseline with the updated public Workflow SDK and Utils dependencies.

## @intloom/workflow-sdk@0.0.3

- Require Node.js 26.4.0+ and expose the Node.js 26 declaration baseline with the updated Utils dependency.

## @intloom/utils@0.0.3

- Require Node.js 26.4.0+ and keep the logger serializer signature self-contained so strict declaration consumers do not inherit unrelated Pino transport types.

## @intloom/cli@0.0.5

- Return immediate Run receipts through CLI and MCP; query the original Run for progress, completion, or failure without replaying execution.
- Reject incomplete model output and preserve clear, bounded model, Tool, and step failure diagnostics without exposing raw SDK output or secrets.
- Preserve Run-scoped logging across independently installed Workflow dependencies, including Code, recovery, and Agent Tools.
- Add optional Host execution limits for Agent steps, model calls, known token usage, and Run duration, with explicit stop reasons and usage summaries.

## @intloom/workflow-intent@0.0.3

- Allow one bounded correction for a rejected Validation report while retaining strict final checks and avoiding replay of project implementation.
- Report deterministic Specification change errors and bounded Validation rule/location diagnostics through the current Run logger.

## @intloom/cli@0.0.3

- Support Node.js 22.22.0+ in both CLI entries and the embedded Kernel while retaining Node.js 24 for repository development and publication.
- Check public contracts against Node.js 22 types and gate publication on isolated Linux/macOS consumers across Node.js 22.22.0, latest 22, 24, and 26.

## @intloom/workflow-intent@0.0.2

- Support Node.js 22.22.0+ with the updated public Workflow SDK and Utils packages.

## @intloom/compiler@0.0.2

- Support Node.js 22.22.0+ and verify standalone Workflow compilation against Node.js 22 consumer types.

## @intloom/workflow-sdk@0.0.2

- Support Node.js 22.22.0+ and validate public declarations with the Node.js 22 type baseline.

## @intloom/utils@0.0.2

- Support Node.js 22.22.0+ without changing logging, error, or identifier behavior.

## @intloom/cli@0.0.2

- Fix global installation of `@intloom/cli` and `intloom` by letting the CLI install the private Kernel's external runtime dependencies.
- Verify both global CLI entries from local release archives before publication.

## @intloom/cli@0.0.1

- Deliver the Node CLI, project host, and local MCP service with the private Kernel, declarations, and SQLite migrations.
- Add the `intloom@0.0.1` lightweight npm entry with an exact dependency on this CLI version.
- Preserve CLI arguments, streams, signals, and color options through the shared executable entry.

## @intloom/workflow-intent@0.0.1

- Publish the independently installed Intent Workflow under `@intloom/workflow-intent`.
- Preserve its three named ESM exports and Skills while using the public SDK instead of a Kernel registry dependency.

## @intloom/compiler@0.0.1

- Publish the Workflow compilation API and declarations for external Workflow authors.

## @intloom/workflow-sdk@0.0.1

- Publish Blueprint, Code, State/Storage/Interaction access, and artifact contracts independently from Kernel and Agent frameworks.

## @intloom/utils@0.0.1

- Publish shared errors, identifiers, and logging support for IntLoom packages.
