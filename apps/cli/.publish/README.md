# IntLoom CLI

`@intloom/cli` provides the `intloom` command for managing projects, running Workflows, and connecting Agent IDEs.

## Usage

Requires Node.js 22.22.0+ and npm; the latest Node.js 24 LTS is recommended. Repository development and publication use Node.js 24+ and Bun. For a published release, install either `intloom` or `@intloom/cli`; both provide the same command:

```sh
npm install -g intloom
intloom --help
```

Create a project and install a compiled Workflow archive. Replace the archive path with your own:

```sh
intloom init my-project --workflow /absolute/path/to/workflow.tgz
cd my-project
```

The target must be new or empty. Projects use `intloom.yaml`; their business code does not require a `package.json`. Workflow installation requires access to the archive's dependencies.

Before running through CLI, configure `llms.default` in `intloom.yaml` and supply the referenced credential in the environment that starts the service:

```yaml
llms:
  default:
    provider: openai-compatible
    model: your-model-id
    secret: ENV.MODEL_API_KEY
    baseURL: https://your-provider.example/v1
```

Replace the model and endpoint placeholders, then start and inspect the project:

```sh
intloom start
intloom doctor --execution cli
intloom flows
intloom flow
```

Interactive `flow` prompts for a loaded Workflow and intent. Answer questions and review confirmations as they appear. Enter inserts a newline in multiline input; Tab focuses submit, then Enter submits. Dismissing an unsubmitted form leaves the Run waiting.

Inspect or continue an existing Run:

```sh
intloom runs
intloom attach <runId>
intloom artifacts
intloom artifact <artifactId> --output ./artifact.json
```

For automation, provide the Workflow name and nonempty intent explicitly:

```sh
intloom flow your_flow --intent-file intent.txt --json
```

For Codex, start the service and run `intloom config codex`. Add its output to your project's `.codex/config.toml`. With `useMcpAgent: true` (the default), the Agent IDE executes Agent tasks without project models; CLI execution always uses project models. Restart the service after changing configuration or startup credentials.

## Commands

Syntax: `intloom [global options] <command>`. Use `intloom <command> --help` for full option details.

### Global options

| Option | Purpose |
| --- | --- |
| `--project <directory>` | Select the exact project root; otherwise search upward from the current directory |
| `--json` | Emit structured output and disable prompts |
| `--no-interactive` | Disable prompts |
| `--no-color` | Disable colors |
| `--info`, `--debug` | Display service logs; debug takes precedence |
| `--version`, `--help` | Show version or help |

### Project and service

| Command | Usage |
| --- | --- |
| `init [directory]` | Create a project; repeat `--workflow <package-or-tgz>` to install Workflows. Directory and explicit `--project` are mutually exclusive. |
| `start [--port <n>]` | Start or reuse the service. Select file or SQLite storage with `localStorage` in YAML before first start. |
| `stop` | Stop the service; normal offline state succeeds without changing data. |
| `status` | Inspect service state and Run counts. |
| `doctor [--execution cli\|studio\|agent_ide]` | Inspect configuration, installation, and readiness; defaults to CLI. |
| `recover [--dry-run]` | Clean eligible stale resources after their owners exit; preview with `--dry-run`. |
| `config codex` | Print connection configuration without modifying IDE files. |

### Workflows and Runs

| Command | Usage |
| --- | --- |
| `workflow add <package-or-tgz>` | Install a Workflow with the service stopped. |
| `workflow remove <package>` | Remove a declaration while retaining committed results. |
| `workflow list` | Inspect declared packages and installation integrity offline. |
| `flows` | Inspect loaded Workflow names and readiness from the running service. |
| `flow [flowName]` | Create a Run; use `--intent <text>` or `--intent-file <file>` (`-` reads stdin). |
| `runs [--flow <name>]` | List Runs in the current service. |
| `attach <runId>` | Inspect and answer an existing Run. |
| `cancel <runId>` | Stop one Run while keeping the service available. |

Package names and loaded Workflow names can differ. To replace a package, stop the service, remove it, add the replacement, and start again. Keep the original Workflow available while its Runs need restart recovery.

### Results and logs

| Command | Usage |
| --- | --- |
| `record <recordId>` | Read a committed Record. |
| `artifacts` | List metadata using `--flow`, `--stage`, `--limit` (1–200, default 50), and `--cursor`. |
| `artifact [artifactId]` | Read by ID or by both `--flow` and `--stage`; do not combine selectors. |
| `artifact … --output <file>` | Export complete JSON; the parent must exist. Existing files require `--overwrite`. |
| `logs [runId]` | Read retained logs offline; accepts `--service` and `--follow`. Run ID and `--service` are mutually exclusive. |

Result queries require a running service. Artifact lists omit business data; detail queries include it. Missing details can return `null`.

### Output and exit status

Business results go to stdout; progress and displayed logs go to stderr. `logs --json` streams JSONL to stdout. JSON and non-TTY commands never prompt.

A waiting Run returns normally; exit 0 does not mean execution completed. Failed or stopped `flow`/`attach` returns nonzero. Successful queries and cancellation return 0. After a timeout or disconnection, inspect the original Run before creating another.

## Directory structure

```text
src/
├── bin.ts          # Node command entry
├── commands/       # Argument parsing and command orchestration
├── application/    # Shared business operations and entry identity
├── service/        # Hosts, discovery, background processes, and cleanup
├── client/         # ProjectClient contracts and remote calls
├── workflows/      # Package installation and declaration management
├── interaction/    # Shared user actions and form handling
├── mcp/            # Protocol, Tools, and interaction adapters
├── ide/codex/      # Codex configuration and presentation
└── ui/             # Terminal prompts, progress, and results
build/              # CLI distribution preparation
test/               # Built-package integration tests and fixtures
```
