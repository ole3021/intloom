# CLI command reference

For task-oriented instructions see [Everyday CLI](../use/cli.md) and [CLI for Loom authors](../author/cli.md). Use `intloom --version` and `intloom COMMAND --help` to inspect your installation.

## Commands

| Command | Purpose |
| --- | --- |
| `status [runId] [--watch]` | Show all unfinished Runs and 10 recent finished Runs, or full details for one Run |
| `loom describe <id[@version] or archive.tgz>` | Describe an installed Loom or statically inspect a compiled-artifact archive |
| `loom remove <id>` | Remove the active installation, keeping snapshots used by existing Runs |
| `dev init/build/test/publish` | Initialize an npm Loom author project or build, test and publish compiled-artifact projects |
| `startup [--port N]` | Start or attach to the service and observe; Ctrl+C leaves it running |
| `init [DIR]` | Create intloom.yaml for a runtime project, preserving existing files. |
| `shutdown` | Preview unfinished Runs, confirm, cancel them and shut down the service |
| `install <source> [--project DIR] [--dependency <source> ...]` | Install an npm Loom by name or archive, or install a compiled-artifact directory/archive and its local dependencies |
| `loom list [--id id]` | Discover installed capabilities |
| `run <selector> [command] [--confirm-delivery] [--input <JSON\|@file\|@->]` | Show npm Loom usage when invoked by name alone, or start and observe the selected command with its input |
| `run create <selector> [--input <JSON\|@file\|@->]` | Create without executing |
| `run start <runId>` | Explicitly start a created Run |
| `run resume <runId> --request <requestId>` | Continue using a saved interaction answer |
| `run resume <runId> --wait <waitId> [--value <JSON\|@file\|@->]` | Continue one external/child wait; child results cannot be supplied |
| `interaction list --run <runId> [--status status]` | List requests |
| `interaction get <requestId>` | Read a request and its response history |
| `interaction respond <requestId> [--value <JSON\|@file\|@->]` | Submit an explicit answer; without value, prompt in a terminal |
| `interaction respond <requestId> --action decline\|dismiss` | Record the action while retaining the pending request |
| `artifact list --run <runId>` / `artifact get <artifactId>` | Query saved files and metadata |
| `artifact read <artifactId> [--offset bytes] [--length bytes]` | Write actual bytes to stdout; `--plain` returns base64 and range information |
| `artifact export <artifactId> --out <path> [--overwrite]` | Copy complete bytes to an explicit destination; reject existing files by default |
| `acceptance list --run <runId>` / `acceptance get <acceptanceId>` | Query immutable reports, candidate versions and quality findings |
| `run stop <runId> [--reason text]` | Request cooperative cancellation |
| `run events <runId> [--after seq] [--limit n]` | Read lifecycle, author log and model receipt events |

For compiled-artifact packages, select by Loom `id`, `id@version` or exact artifact digest. These compiled artifacts are indexed in the user-wide IntLoom store. Both explicit installation and automatic acquisition download registry archives into this store. Run project context comes from each caller, independently of the service startup directory. The terminal lists active Looms by ID and version. Reinstalling a direct package switches the current ID after verification; existing Runs retain their exact installed bytes.

For npm Looms, install by npm name or archive. Installation is global by default; `--project DIR` installs in that npm project. Run from the project to prefer its copy. `intloom run NAME` prints command usage; `intloom run NAME COMMAND --input JSON` selects an entry. Use `--confirm-delivery` to request formal review. Build npm Looms with the generated project script (`npm run build`).

For compiled-artifact projects, `intloom dev build` creates `dist/<name>-<version>.tgz`; `--path DIR` selects another output directory. Dependency resolution and packing are part of the build. Declare dependencies in `defineLoom`; the build generates typed references before typechecking. Keep `loom.lock.json` to pin dependencies; use `dev build --update` to change the selection. Install Loom archives with `intloom install`.

`loom list`, `artifact list` and `acceptance list` accept `--cursor` and `--limit` (default 20, maximum 100). `status` always uses its fixed history limit. Independent compiled-artifact builds can run without the service. Compiled-artifact dependency builds use its catalog.

Input accepts inline JSON, a UTF-8 file with `@path`, or stdin with `@-`.
Omission submits no value, allowing a declared root default; it never invents
`{}`. `run` writes its new Run ID to stderr before observing. Closing or
interrupting an observer does not cancel the Run. `run start` returns an acknowledgement. `run stop` waits for cancellation to settle and returns the control receipt with the terminal Run.

## Interactive terminal

A live run or service view keeps a bounded recent history on screen. Leaving
the view restores the terminal and prints the last snapshot and the transcript
path. Redirecting the output gives an append-only stream. Use `--details` on
`run` or `dev test` for full paths and diagnostics. Service transitions carry
timestamps, levels and run IDs. Author logs appear with their owning run. A
status query for one run includes its business output and available execution
error details.

## Output, configuration and local transport

`--plain` is the single automation mode. It disables prompts, menus, colors,
decorative status marks and in-place redraws even when a caller allocates a TTY.
Results use a compact `{ok:true,data}` or `{ok:false,error}` JSON document on stdout;
progress and logs append ordinary text to stderr. Structured log data stays complete
as compact JSON, without terminal-width wrapping. Compiler failures are included in
the JSON error details. The former `--json` option is removed, without an alias.

`status --watch --plain` appends one JSON snapshot per observed change. A single
Run watch writes events to stderr and its final snapshot to stdout; `--timeout`
can bound that observation. Missing input fails with exit code 2 rather than opening
a form. Execution returns exit code 3 when waiting for input unless explicitly
asked to keep watching. Supply answers through `--value`; plain mode cannot grant
human Approval or bypass publication confirmation. `dev publish --dry-run --plain`
returns a reviewable preview.
Human-facing build and status commands print readable summaries; data-oriented
queries retain formatted JSON. Human-readable errors are separated from normal
output on stderr. Command error projections contain `code`, `message` and optional
`details`; unexpected transport errors remain generic. Persisted Run errors can
include credential-redacted original execution diagnostics.
Queries and accepted control operations return exit code 0 even when the queried
Run has failed. Executing/observing returns 0 for success, 1 for failure,
cancellation or interruption, 3 for a wait, and 4 for an observer timeout. Invalid arguments
or input/answer validation return 2. Interrupting an observer or interactive answer returns 130.
Executing a successful Run with rejected quality returns 5. A status query or completed status watch returns 0. Use `status <runId> --plain` to read
`quality` and the selected Acceptance summary; `succeeded` alone is not quality
approval. Queries and exports do not change any saved quality conclusion.

The Intloom service reads `~/.intloom/intloom.yaml` and the selected project's `intloom.yaml`. Configure `profiles.default` for Agent execution. Model slots, profile resolution and credential precedence are described in the [Kernel contract](../../packages/kernel/README.md).

CLI transport uses a private Unix socket and a mode-0600 `~/.intloom/service.json` descriptor. MCP uses the same persistent credential from `~/.intloom/token` as a Bearer token. The descriptor holds a local access token; do not
distribute it. Requests carry a protocol version and correlation ID, use explicit
method dispatch, and are never automatically retried after connection loss.
Request/response messages are limited to 8 MiB; larger results return
`RESULT_TOO_LARGE`, never a truncated success. A response timeout does not prove
that a submitted operation failed. Query the service before retrying.

The CLI currently supports Unix sockets on Linux/macOS. Persistent waiting,
interaction records and explicit resume share the Kernel's records across unexpected service exits and embedded Kernel reopenings. `--request` and `--wait` are mutually exclusive. A request resume uses
its saved answer, and cannot accept `--value`.

Argument, file and pipe answers use `program / cli`. Interactive answers require explicit submission. Ctrl-C during review records a dismissal when delivered and leaves the Run waiting. Automated terminal tests set `INTLOOM_CLI_TEST=1` to record `test / cli`. Human-required requests reject test and program submissions. CI and `--plain` do not open prompts.
Queries do not open prompts automatically, and receipts do not claim completion.

A ranged or `--plain` Artifact read returns at most 1 MiB, with `offset`, actual
`length`, `totalSize` and `eof`. `--plain` adds `encoding: "base64"` and encoded `data`.
Raw stdout without range flags reads to EOF. Export prepares a temporary file,
reads all ranges, verifies size and SHA-256, then copies it into the destination.
A failure preserves any existing destination. It does not derive a path from the artifact name.
`--overwrite` explicitly allows replacing an existing destination. There are no
external Artifact-write or Acceptance-approval commands.

`init [DIR]` creates a minimal `intloom.yaml` in an existing or new runtime project. Existing files are preserved and an existing YAML file is never overwritten. `dev init [DIR] --id ID [--name DISPLAY]` creates `loom.yaml`, `loom.ts` and `package.json` in an empty author directory. It does not install dependencies or publish packages.

`startup --port N` overrides the configured MCP port for that service session (1–65535). The default is 7341; persistent configuration lives at `~/.intloom/intloom.yaml` under `service.port`. An occupied port or invalid configuration fails with the path/port and repair guidance. An already-running service is reused; a conflicting requested port requires `shutdown` followed by a new `startup --port N`.

A missing or corrupt registered project store is reported in `status` and is never recreated as an empty database. Healthy stores remain usable. Restore the original data/path/permissions, then restart the service. Shutdown retains stop requests for inaccessible Runs in the global index; restored Runs cannot resume a saved stop request. An unconfirmed active execution is reported as interrupted, never as successfully completed.

`startup` exposes 20 fixed tools and immutable Artifact resources over authenticated Streamable HTTP using protocol `2026-07-28`. Client disconnects do not shut down the service or cancel Runs. MCP `intloom_run_create` accepts an optional absolute `directory` for project discovery; absence supplies no project. See [MCP setup](mcp.md) and the [Kernel contract](../../packages/kernel/README.md).

## Structured Run status

`status <runId>`, `status <runId> --watch` and `run` render the Kernel activity
projection: planned steps, parallel active calls, recent completed Tools and Models, active/waiting durations,
pending Ask or Approval, validation, artifact counts and actual model usage.
Dynamic workflows omit a guessed total. Missing token or cost receipts remain
unavailable; currencies are kept separate. A successful Run may still have
rejected acceptance. Full output and artifact contents remain separate reads.

`status <runId> --plain` returns `run`, `activity`, `result`, `artifacts` and pending `questions`. Run watches use cursor waits;
Ctrl+C closes the pending observation connection and leaves the Run running.
History remains static text and only the current overview animates. Run details
share one layout: command and Run identity, planned Step rows with status and
duration, Tool / Model details beneath their owning Step, and an elapsed /
progress / artifact footer. Run marks retain three blocks; Steps use one block.
On smaller terminals, complete rows are prioritized (active / waiting / failed
Steps first), hidden row counts are explicit, and the status and footer remain
visible when space permits. Recent logs occupy the remaining space; the Log
file keeps their complete history. `startup` and the Run overview use the same
status and progress terminology. Default `status <runId>` and the final result
print the full detail, including reported usage. Recent ended calls are bounded
to the last 20; `run events <runId>` provides the event history. Tool outputs
are not interpreted as summaries. A Code
Loom without planned steps omits step counters. Explicit Approval offers Defer, Approve and Reject;
`--value` uses a program source and cannot submit an Approval.

The [event store](run-events.md) and manifests use the current format. Old layouts and commands are not migrated automatically.
