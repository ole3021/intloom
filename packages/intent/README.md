# @intloom/workflow-intent

The software-development Workflow for IntLoom. It carries one intent through Specification → Solution → Implementation → Validation under the same Run ID, with human confirmation of requirements and design before project changes.

## Usage

Requires Node.js 24+, the IntLoom CLI, and an initialized project. See [installation and project setup](https://github.com/ole3021/intloom/blob/main/docs/guide/quickstart/installation.md) for source builds and published-release prerequisites.

From the project directory, with its service stopped, install a compiled Intent archive and start the host:

```sh
intloom workflow add /absolute/path/to/intloom-workflow-intent.tgz
intloom start
intloom flow intent --intent "Build a Todo app with local persistence"
```

Replace the archive path with the package you obtained. Its runtime dependencies must be resolvable. When the package and dependencies are available from your registry, `intloom workflow add @intloom/workflow-intent` also works.

CLI execution uses the project's configured `llms`. For a connected Agent IDE, MCP with `useMcpAgent: true` uses the client's Agent execution environment. See the [CLI guide](https://github.com/ole3021/intloom/blob/main/docs/guide/quickstart/cli.md) or [MCP guide](https://github.com/ole3021/intloom/blob/main/docs/guide/quickstart/mcp.md) for model setup and connection instructions.

Answer questions and review confirmations to continue the same Run. Feedback revises the current draft. Inspect execution and saved results with:

```sh
intloom runs
intloom artifacts
```

## Stages and results

| Stage | Responsibility | Saved output |
| --- | --- | --- |
| Specification | Clarify requirements, review cumulative changes, obtain confirmation | Specification Artifact and Record |
| Solution | Design against confirmed requirements, agree on build/test commands, obtain confirmation | Solution Artifact and Record |
| Implementation | Change project files, record their origins, pass host-executed checks | Implementation Record with file hashes and command results |
| Validation | Repeat the checks independently, assess coverage, save evidence and findings | Validation Artifact |

Agents submit proposals; Code owns real user answers, confirmation, host check results, and persistence. `completed` means the Validation report was saved; read its findings and per-target results to assess the delivered work.

Intent is exclusive within one host while active, including waits. Earlier commits and project edits remain after failure or cancellation. Specification question/confirmation waits support restart recovery; Solution waits currently require the live host. Inspect saved results before starting another Run after failure.

## Source organization

| Path | Responsibility |
| --- | --- |
| `workflow.yaml`, `stages/` | Four-Stage topology, Steps, resources, and outcome routes |
| `initializers/` | Construct each Stage's seed from the actual Run ID and intent |
| [schemas/](https://github.com/ole3021/intloom/blob/main/packages/intent/schemas/README.md) | Direct Zod State, proposal, Artifact, Record, and command contracts |
| `codes/` | Initialization, interaction, checks, and finalization |
| [src/](https://github.com/ole3021/intloom/blob/main/packages/intent/src/README.md) | Business rules, confirmation formatting, snapshots, and persistence helpers |
| `tools/`, `agents/`, `skills/` | Agent capabilities, instructions, and Specification Skills |
| `build.ts`, [build/](https://github.com/ole3021/intloom/blob/main/packages/intent/build/README.md) | Compile the Workflow and prepare its distribution manifest |
| [test/](https://github.com/ole3021/intloom/blob/main/packages/intent/test/README.md) | Built-package integration tests and fixtures |

The compiled package exports `blueprint`, `codes`, and `agentSpecs`. Source navigation links point to the repository because source files and development READMEs are not included in the distribution.
