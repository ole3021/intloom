# @intloom/intent

Intent advances a feature-development round and preserves project facts that later development can understand and use. It addresses unclear intent, drift between requirements/design/code, changes without traceable reasons, and completion claims without evidence.

It adds, adjusts, removes, or fixes features, including their necessary module and test changes. Independent code cleanup and restructuring belong to a separate Loom. A fix can leave formal requirements unchanged while still having an explicit round scope. Business constraints and preferences enter through `prompt`.

## Four stages

| Stage | Responsibility | Formal output |
| --- | --- | --- |
| Specification | Analyze intent and existing facts; draft and confirm features, requirements, acceptance conditions and round scope | Full requirement Record + current requirement Artifact |
| Solution | Analyze fixed requirements; confirm design, implementation dependencies and verification responsibilities | Full solution Record + current design Artifact |
| Implementation | Make the planned changes, record actual operations and verify a fixed candidate | Project files + Implementation Record; no Artifact |
| Validation | Independently collect evidence, assess every target and review historical findings | Validation Record + cumulative validation Artifact |

Each stage commits once per Run. A downstream stage resolves the preceding Record and its immutable upstream references, never substitutes the latest Artifact. Substantive changes to a committed requirement, design or delivered candidate start a new Run. Validation does not repair product files.

Specification and Solution use separate analysis and draft/design Steps with the same Agent. Tools edit drafts in batches; Code assigns new IDs, checks relationships and obtains actual user confirmation. `roundCriteria` belong only to the round's Record. A partial Implementation handoff needs an explicit candidate-bound user decision and preserves the complete acceptance scope.

Verification plans assign work to `implementation`, `validation` or `both`. Commands produce host receipts; procedure observations reference actual operations, reads or user reports. A saved Validation report may be `passed`, `failed`, `partial` or `undone`. Run completion means the report was committed, not that every target passed. Historical conclusions retain their original candidate and target definition; omitted findings do not close automatically.

## Build and use

Development uses Bun; the supported runtime is Node.js 26.4.0+. From the repository root:

```sh
bun run build --filter=@intloom/intent
```

Developers can also run `intloom build packages/intent`, or `intloom build` inside the package directory with the development CLI available. The definition lives in `package.json` → `loom`. There is no separate Loom definition file or Intent-specific build script.

Users install a built archive with `intloom loom add /absolute/path/to/intloom-intent.tgz`. When available from the configured registry, `intloom loom add @intloom/intent` installs the published package. After project/model setup:

```sh
intloom run intent --prompt "Build a task management application"
intloom runs
intloom attach <run-id>
```

Answer the pending questions and review the displayed version. Feedback revises an uncommitted draft. Cancellation does not roll back earlier formal results or project edits. Intent is exclusive within a host; do not run competing writers in the same workspace. Candidate hashes detect drift but do not back up files or identify running services. An interrupted command without a settled receipt blocks continuation rather than being automatically replayed.

## Source ownership

| Path | Owns |
| --- | --- |
| `package.json` → `loom` | Input kinds and stage topology |
| `stages/<stage>/stage.yaml` | Step routing and capability bindings |
| `stages/<stage>/schema/` | Editable submissions, State and formal outputs |
| `stages/<stage>/src/` | Stage rules and transitions |
| `stages/<stage>/codes/` | SDK Code Step entry points and interaction recovery |
| `stages/<stage>/tools/` | Typed business operations |
| `stages/<stage>/agents/`, `skills/` | Role boundaries and reusable methods |
| `src/` | Shared IDs, evidence, project operations, interactions and publication |
| `test/` | Focused storage, loader and package integration |

The compiled distribution exports `blueprint`, `codes`, and `agentSpecs`. It contains no source tests. See [shared code](src/README.md), [tests](test/README.md), [Intent guide](../../docs/guide/intent/overview.md), and [Loom design principles](../../docs/guide/development/design-principles.md).

The previous Intent data format is replaced without a compatibility migration. Existing legacy Artifacts and Records cannot serve as the new flow's formal basis.

This refactor does not update or run the existing E2E harness. Its historical cases are not proof of the new flow; real-model and two-round E2E validation remain deferred.
