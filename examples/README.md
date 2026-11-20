# Examples

These Looms exercise the 0.5 authoring and build pipeline:

| Package | Demonstrates |
| --- | --- |
| `code-report` | Typed Code entry, required prompt and Markdown output |
| `agent-research` | Named Agent entry/main Agent, dynamic instructions, structured review tool, complete Skill resources and explicit assets |
| `workflow-report` | Workflow entry, Agent steps, `next`, optional `when`, nested Workflow `repeat` and Code output |
| [Hello Loom](hello-loom/README.md) | Three-step localized greeting, user input, weather fallback and Markdown output |
| [Meeting Notes](meeting-notes/README.md) | Structured Agent, packaged instructions, strict input reading, source-line evidence and reusable highlights |
| [Intent Loom](intent-loom/README.md) | Five stages, nested review Workflows, bounded revisions, four Agents, complete Skill resources and independent command evidence |

From the repository root:

```sh
bun install --frozen-lockfile
bun run build
bun run build:dev
intloom-dev check examples/workflow-report
intloom-dev build examples/agent-research
```

Each example is a workspace with ordinary versioned runtime dependencies. Its `dist/` is also an independent npm package; `npm pack` inside that directory creates an installable archive. The package consumer test builds all six from source using installed Compiler/SDK archives, installs the Loom archives into another project, imports the definitions, checks resources and consumes generated TypeScript declarations.

The three larger examples run with real Kernel tool scopes, scripted Agent/user/weather responses and a test-only Workflow interpreter. Intent's verification commands run as managed Node.js subprocesses against small, medium and large candidates. These tests exercise compiled business behavior and tool primitives; complete Kernel lifecycle execution and live models remain subsequent work.
