# Changelog

## Unreleased

- Retry npm publication visibility before consumer verification, and distinguish unavailable versions from actual archive integrity conflicts.
- Reserve CLI start/stop for service lifecycle and use flow, cancelRun, and cancelAllRuns for Kernel/Runtime execution.
- Standardize RunView.cursor across CLI/MCP, query and answer names, and Workflow initialization diagnostic types.
- Deprecate Query and SnapshotCategory in favor of StorageQuery and StorageCategory; retain compatibility aliases.

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
