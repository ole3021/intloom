# @intloom/kernel

Code Run execution, persistent data and managed file, process and feedback capabilities for Intloom 0.5.

## Code Runs

`openKernel()` opens a scheduling host on macOS or Linux. Each Code-entry Loom Run uses an independent Node process. Its Code children share that process, closures and directories, with separate Exec records. Agent and Workflow execution are subsequent capabilities.

```ts
import { openKernel } from "@intloom/kernel";

const kernel = await openKernel({ dataDir: "/absolute/intloom-data" });
try {
  const installation = await kernel.registerInstallation({
    directory: "/prepared/npm-project",
    packagePath: "node_modules/@example/report",
  });
  const { runId } = await kernel.startRun({
    package: installation.package,
    input: { prompt: "Write the report" },
    // workspace Looms require workDir: "/existing/workspace"
  });
  console.log(await kernel.waitRun(runId));
} finally {
  await kernel.close();
}
```

For interactive Looms, observe and answer while `waitRun` is pending:

```ts
for await (const event of kernel.observeRun(runId)) {
  if (event.type === "interaction" && event.data.status === "pending") {
    // Render event.data and collect a host/user decision.
    // Questions: { status: "answered", value }, { status: "skipped" },
    // or { status: "deferred" }, when the question permits it.
    // Authorization: "once", "run", or "deny".
    await kernel.submitAnswer(event.data.id, answer);
  }
}
```

- `startRun({ package, input, workDir?, env? })` validates installation, Code entry, input declarations and existing material/workspace paths before creating a record. Later loading, binding and business failures produce a recorded result with identity.
- `getRun(runId)` and `listRuns({ loomId?, phase?, limit?, cursor? })` read persisted task facts. Phases are `preparing`, `running`, `cancelling`, `finalizing`, `finished`. Questions are separate records with pending/deferred or resolved status.
- `observeRun(runId, { cursor?, signal? })` is an async iterator of persisted events. Every event includes a replay cursor; resume after that event on the same Run, including after reopening. The iterator ends after finished/interrupted history is drained. Aborting or returning the iterator stops observation. `listRunEvents` provides paginated history through both runtime and data APIs.
- `submitAnswer(interactionId, answer)` returns `accepted` or `pending` with retained draft/issues. Executable Zod validators stay in the execution process; questions, retries and accepted answers are persisted by the host. Deferred questions remain waiting.
- `cancelRun(runId, reason?)` requests cancellation. `waitRun(runId)` resolves only after activities stop, cleanup and output checks finish. The default cooperative grace is 2000 ms, configurable with `openKernel({ cancellationGraceMs })`, followed by forced process termination.
- Normal completion waits for managed child calls, questions and commands. Caught child failures/rejections can be handled. Ignored failing calls fail the Run. Entry failure/rejection stops remaining activities and uses the same grace period to terminate unresponsive children, retaining the primary conclusion. Ordinary timers and unrelated asynchronous work are not managed activities.
- Run results use SDK `RunResult`: `execution.status` is independent of `outputs.status` (`none / ready / incomplete`). Issues identify missing, mismatched, empty-directory or inaccessible outputs. `outputs.result` contains available declared artifacts, including partial `files`. `outputs.current` equals available workspace files; an intloom Run adopts its complete outputs on success. Failed intloom results retain available artifacts without adopting them.
- Cleanup failures are recorded separately. They preserve an existing failure/rejection/cancellation; cleanup failure after business success makes the Run fail finalization. Business Exec return values remain in Exec completion records, separate from `RunResult`.

### Directories, permissions and environment

For intloom scope, Kernel allocates `runs/<runId>/work/`; workspace scope uses an explicitly selected existing directory. The execution process's cwd matches `workDir`. Both scopes allocate managed `temp/`, removed after managed activities stop. Work/history remain. Material inputs retain their resolved original full paths and live contents.

Managed file tools read/write work/temp, read supplied input files/folders and installation resources, and resolve relative paths against workDir. An input inside writable workspace remains writable. Access outside these defaults prompts with the actual path and read/write operation. Grants may apply once or to that path range for this Run. Installation copies and internal data files cannot be written through business file tools; use `context.store` for business KV.

Every managed command requires approval for its command, arguments, cwd and explicit env combination. Denial rejects that tool call with `AuthorizationDeniedError` and can be caught. Command grants may be single-use or reusable within the Run. Changed arguments, cwd or explicit env require a new grant.

The execution process uses Node built-in permissions: runtime/installation code-loading reads are allowed; direct business file access, child-process creation, Workers and native addons are restricted. This is trusted-code mistake prevention. Approved external commands run with current-user privileges and can access files outside Node's permissions. Ordinary network access remains allowed, including Node versions that require an explicit network permission flag.

The runtime supplies `PATH` and Run-specific `TMPDIR / TMP / TEMP`. `openKernel({ env })` and host `startRun({ env })` explicitly add or override variables; commands also accept explicit `env`. Other host variables, including model credentials and `NODE_OPTIONS`, are not inherited automatically. Runtime environment values are not stored in Run records. Command authorization records include the command's explicit env.

By default the execution Node is `process.execPath`; `nodePath` selects another executable. Development commands use Bun; the execution process requires a supported Node version.

### Ownership and interruption

One scheduling host owns a dataDir. Independently opened `openKernelData` and `openStore` handles remain available. Normal `kernel.close()` cancels owned active Runs, waits for finalization, then closes resources.

A child crash is finalized as failure by the live host. After a scheduling-host crash, reopening records interruption while preserving the last phase, outstanding questions and known process IDs. `waitRun` throws `RunInterruptedError` until disposition. Code is not replayed. Once the host/operator confirms all associated processes stopped, call `finalizeInterruptedRun(runId, { processesStopped: true })` to clean temporary resources, inspect outputs and finish as failed. There is no supervisor guaranteeing child or command termination after host death.

## Persistent data

The data APIs run on Node.js using its built-in `node:sqlite`. Development commands use Bun; supported Node versions are listed in `package.json`.

```ts
import { openStore, openKernelData } from "@intloom/kernel";

const store = await openStore("@example/report");
try {
  await store.set("preferences", { language: "en" });
  console.log(await store.get("preferences"));
} finally {
  await store.close();
}

const data = await openKernelData({ dataDir: "/absolute/intloom-data" });
try {
  const installation = await data.registerInstallation({
    directory: "/prepared/npm-project",
    packagePath: "node_modules/@example/report",
    source: "local archive",
  });
  console.log(await data.getInstallation(installation.package));
  console.log(await data.listExecutions({ loomId: installation.package.name }));
} finally {
  await data.close();
}
```

### Store

- `openStore()` opens the global KV Store; `openStore(loomId)` opens a Loom's Store. An optional second argument `{ dataDir }` selects a different root, including `openStore(undefined, { dataDir })` for its global Store.
- The default root is `~/.intloom`. A Loom's identity is its complete npm package name. All its versions share one business Store; the Loom owns the compatibility of its JSON data.
- `get` returns `undefined` for a missing key and preserves stored `null`. `set` replaces the complete value. `delete` also succeeds for missing keys.
- Values must be JSON-compatible plain objects, arrays, strings, finite numbers, booleans or null. Unsupported values, including nested `undefined`, are rejected before writing. Keys use valid UTF-8 strings.
- `list({ prefix?, limit?, cursor? })` returns `{ entries, nextCursor? }`. Prefixes are literal and case-sensitive. Keys sort in UTF-8 binary order; pages default to 100 entries and allow 1–1000. Cursors belong to one Store and prefix, remain usable after reopening, and read current data when each page is requested.
- Each write is atomic. A separate `get` followed by `set` is two operations. SQLite lock contention waits up to one second before rejecting. Database operations are synchronous internally and occupy the calling thread.
- Each `openStore` handle owns its connection and has idempotent `close()`. `data.getStore(loomId?)` lazily reuses Kernel-owned connections and returns only the four KV methods. Closing `data` releases those connections; independently opened handles remain usable.

### Installations and execution facts

`registerInstallation({ directory, packagePath, source? })` copies a **self-contained, prepared installation** into managed storage. `packagePath` is relative to that directory, or `"."` when the Loom itself is the installation root. Include its installed dependencies in the prepared tree. Registration validates package and compiled-manifest identity, declared resource paths and internal links, and records installed dependency names and versions. Modules are loaded by the execution layer, not by registration.

One `name@version` can be registered once per data root. Registration never overwrites it; changed code or dependencies require a new package version. The retained copy is independent of the original prepared directory. Links must resolve inside that prepared tree. Host-side filesystem access remains outside this storage API's controls.

The record APIs store facts supplied by a host:

- Root `createExecution` takes `package`, `kind`, optional JSON `input`, and an explicit association: `{ mode: "chat" }`, `{ mode: "run", runId }` or `{ mode: "patch", runId, patchId }`. It allocates only an execution ID. Child creation takes `parentId` instead of association fields and inherits its parent's package/mode/Run/PATCH binding.
- `completeExecution(id, { result, value? })` records the SDK's `succeeded / failed / rejected / cancelled` result and an optional JSON-compatible internal return value. Each execution completes once.
- `getExecution(id)` reads a record; `listExecutions({ loomId?, runId?, mode?, status?, limit?, cursor? })` lists records in registration order. `status: "recorded"` selects records without a completion; it does not imply an active executor.
- `listEvents(id, { limit?, cursor? })` reads ordered `recorded` and `completed` facts. Each state change and corresponding event commit in one transaction. Cursors are query-specific; list limits match Store limits.

These low-level APIs persist supplied facts. `openKernel` adds the Code executor and task lifecycle; `openKernelData` also provides read-only Run/history queries.

### Layout and retention

```text
<dataDir>/
  store.sqlite
  system.sqlite
  looms/<encoded-package-name>/
    store.sqlite
    installations/<encoded-version>/
    runs/<runId>/
      work/  # intloom scope
      temp/  # both scopes; removed after finalization
```

Global KV, system records and each Loom's business KV use separate databases. Package-name/version directory components use percent encoding. System schema v2 transactionally migrates v1 executions/events, retaining IDs, parentage and event positions and adding `mode: "run"` with their original runId. Historical records do not create runtime Runs or fabricate directory/output facts. KV remains schema v1. Migration failure rolls back; newer unsupported schemas are rejected. Data, history and registered installations are retained until explicitly managed.

## Execution-scoped tools

```ts
import { createToolScope } from "@intloom/kernel";

const tools = createToolScope({ tempDir: "/existing/temporary/root" });
try {
  const waiting = tools.user.ask({ question: "Proceed?", mode: "confirm" });
  const [pending] = tools.interactions.list();
  tools.interactions.submit(pending.id, { status: "answered", value: false });
  console.log(await waiting); // { status: "answered", value: false }
} finally {
  const cleanupFailures = await tools.close();
  console.log(cleanupFailures);
}
```

`createToolScope({ tempDir, signal?, onInteraction?, env?, authorizePath?, authorizeCommand?, onProcess? })` returns `fs / process / user / signal / reject`, an interaction collection, `cancel(reason?)`, `cleanupFailures` and idempotent `close()`. The host provides an existing temporary root and closes the scope after use. Only directories created with `fs.mkdtemp` are owned for automatic removal. Bare scopes provide tool primitives; the runtime supplies authorization callbacks and an explicit environment.

- File operations implement the SDK's strict UTF-8 contract. Writes validate before touching the destination and replace from a sibling temporary file. `stat` defaults to inspecting links; missing paths return `null`.
- Processes execute a command and argument array directly, using scope `env` (or the host environment for a bare scope) plus command overrides. Default combined output capture is 1 MiB. All output is UTF-8 validated, including bytes after truncation. Nonzero exits and launch/timeout/signal outcomes return receipts. Cancellation rejects with `ExecutionCancelledError`. Process groups on POSIX and tree termination on Windows manage descendants; POSIX termination escalates from SIGTERM to SIGKILL after 250 ms. Remaining descendants stop when the command leader exits.
- `cancel()` or an upstream abort blocks new operations, rejects pending questions and stops managed processes. Closing also waits for in-flight file operations, stops processes and removes registered temporary directories. Cleanup can run after cancellation; failures are recorded and returned without replacing a preceding business error.
- `interactions.list()` returns pending/deferred questions. `submit(id, submission)` accepts `answered`, `skipped` or `deferred` submissions. Answer validation errors return `pending` with the same ID, retained draft and issues. Deferred submissions retain waiting; only accepted answers or permitted skips resolve `ask`. `onInteraction` receives initial and updated pending records synchronously. Requests and submissions are validated at this boundary.
- `reject({ reason })` throws `ExecutionRejectedError`; callers can handle it. It does not itself remove business output files or cancel the scope.

Tool scopes keep their interactions and resource bookkeeping in memory. The current CLI exposes authoring commands. See the [SDK contracts](../loom-sdk/README.md) for author-facing types and `withTempDir`.

See [development](../../docs/maintainers/development.md) for workspace checks.
