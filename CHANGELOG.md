# Changelog

## @intloom/cli@0.1.0

- Adopt Loom commands and contracts: `run`, `looms`, `loom add/list/remove/install`, `--loom`, and `--prompt`. Update CMD, TUI and MCP together; old Workflow command names are not compatibility aliases.
- Separate CMD/TUI, Core, Client and Service responsibilities. Bundle Kernel 0.1.0 with explicit Host, Operations, Runtime, Execution and Access boundaries; coordinate the `intloom` launcher at 0.1.0.
- Use strict `looms` project configuration and `thinking`/`working`/`coding` model roles. Remove legacy `intent.apps` configuration.
- Preserve immediate receipts and unknown write outcomes; follow the original Run without replaying side effects. Keep service start/stop separate from Run execution.
- Share release consumer import/storage and CLI setup probes with prepublication tests. Update bilingual setup examples and keep real-model E2E acceptance separate from local validation.

## @intloom/intent@0.1.0

- Replace `@intloom/workflow-intent` with `@intloom/intent`, compiled against Loom protocol 2026-10-15 and the 0.1.0 SDK/Utils packages.
- Use the four-stage Specification, Solution, Implementation and Validation contracts with explicit State, candidate confirmation, durable Artifacts and Records.
- Replace the previous Intent data format without a compatibility migration. Historical Artifacts and Records cannot be used as the new contract's formal basis.
- Migrate S01/M01 and the CMD/MCP E2E harness to the current contract; fresh real-model reports are required for runtime acceptance.

## @intloom/compiler@0.1.0

- Compile Loom packages through `compileLoom`, `package.json.loom` definitions and per-Stage YAML using protocol 2026-10-15.
- Emit root-layout packages with named `blueprint`, `codes` and `agentSpecs` exports, declarations and declared Skill assets; use the 0.1.0 public dependencies.

## @intloom/loom-sdk@0.1.0

- Replace `@intloom/workflow-sdk` with `@intloom/loom-sdk`; expose `loomProtocolVersion`, Loom module schemas and `loomName` contracts.
- Define executable Stage initialization, Code/Agent/Tool contracts and State/Storage/Interaction access independently from Kernel.
- Use `StorageQuery` and `StorageCategory`; retired Query and SnapshotCategory aliases are not retained.

## @intloom/utils@0.1.0

- Coordinate shared errors, identifiers and logger contexts with the 0.1.0 Loom packages, retaining Node.js 26.4.0+ support.

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
