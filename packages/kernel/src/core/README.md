# Core: project execution environments and coordination functions

N5 uses option B. Kernel exposes ordinary functions, and the host retains ProjectExecution. There is no Kernel instance, module-global singleton, project cache, or second Run state. Runtime owns RunState and the current Stage State; Registry owns loaded executable resources.

## Initialization and resource ownership

```ts
import { createEffector, initializeProject, flow, getRun, answerAsk, cancelAllRuns } from "@intloom/kernel";

// The host selects and creates Storage; the standard Effector is directly available.
const execution = await initializeProject(projectRoot, {
  effector: createEffector(),
  storage: storageHandle.access,
});
const view = await flow(execution, "intent", "Original intent text");
const snapshot = await getRun(execution, view.runId);
if (snapshot.pendingAction) {
  // Collect a matching answer and resume the same Runtime.
  await answerAsk(execution, snapshot.runId, snapshot.pendingAction.id, answer);
}
// Stop accepting requests, cancel all Runs, then release resources according to the adapter.
await cancelAllRuns(execution);
await storageHandle.dispose();
```

N7.1 supplies createEffector; N7.2 supplies storage/file and storage/sqlite factories. Hosts also release their resources after initialization failure. cancelRun signals cooperative cancellation without waiting for or rolling back external operations. StorageHandle.dispose rejects new operations and drains accepted operations before releasing resources; logical stopping does not mean all side effects ended. The standard Effector stores policy and has no disposal method. External SDK resources currently have no unified disposal contract. See [Effector boundaries](../effector/README.md).

| Object | Location and lifecycle |
| --- | --- |
| ProjectExecution | Host-retained projectRoot, registries, runtime, workflows, and executionReadiness callback |
| Registry | In-memory Blueprint, Code, Agent, and source tables; frozen after initialization and rebuilt from dependencies on restart |
| RunState / Stage State | Runtime closure; waiting retains the original Code Promise, which cannot survive process exit |
| Artifact / Record | Injected StorageAccess; adapters determine file/database persistence |
| StorageHandle | Host owns access and dispose; business code receives access only |

Each initializeProject creates a new Runtime without replacing existing environments. Reinitializing the same directory cannot recover old Runs; hosts must retain the original environment and route answers to it. Environments may share Workflow/resource names but never Run state. When sharing a Storage implementation, the host selects file directories and SQL projectId: equal scopes share business data, while different scopes isolate it. Future multi-project reference management belongs to the host; no manager is added here.

Registry contains functions, Zod Schemas, and LoadedAgent resource descriptions and cannot be serialized into Storage. Only resource tables are frozen, not business Schemas or SDK objects. Hot reload, SDK disposal, and Run eviction require separate design.

## Initialization and configuration

```text
Host creates Effector / Storage
  → initializeProject(projectRoot, { effector, storage })
  → checkProject: canonical directory and project configuration entry
  → loadConfig: YAML parsing → LoomConfig Schema
  → initializeWorkflows: discover → load/validate resources → register packages
  → freeze Registry tables → createRuntime → ProjectExecution
```

Read intloom.yaml in the exact project root. Kernel does not search parents, install packages, generate files, insert a model, merge configuration, or decrypt environment files. CLI owns discovery and installation. Configurations normalize omitted workflows to [] and localStorage to file. Minimal project configuration:

```yaml
localStorage: file
useMcpAgent: true
workflows: []
intent:
  apps: []
```

secret accepts only ENV.NAME / DENV.NAME references. The host prepares/decrypts the environment; the service implementation reads required credentials before Run creation. llms is optional at startup; supplied configuration is still structurally validated. Configuration loading and resource registration do not resolve credentials. Hosts interpret localStorage and create the selected backend; Kernel still receives borrowed StorageAccess and does not construct a backend. workflows entries contain name, exact version, archive sha256 and optional local source. Only the CLI maintains that list.

Use one YAML 1.2 document; reject duplicate keys, aliases, parsing warnings, and Schema mismatches. See the [yaml Document API](https://eemeli.org/yaml/#documents). Missing configuration yields NOT_FOUND, read failures KERNEL_UNAVAILABLE, and invalid content INVALID_REQUEST. Retain internal cause without echoing configuration contents.

## Calls and errors

| Function | Responsibility |
| --- | --- |
| flow(execution, flowName, intent, source = "cli") | Find the successful Registry entry and delegate preparation/execution to the same Runtime, preserving original intent |
| getRun / listRuns | Read projections from the same Runtime without a second state cache |
| answerAsk(execution, runId, actionId, answer) | Delegate validation and original Promise delivery to the same Runtime |
| cancelRun(execution, runId) | Cancel one Run without closing host resources |
| cancelAllRuns(execution) | Cancel all active Runs without closing host resources |
| listWorkflows(execution, source = "cli") | Project resource availability and entry-specific readiness with safe errors |

Unknown flowName throws NOT_FOUND. Only failed packages with a confirmed flowName can map to KERNEL_UNAVAILABLE; never infer it from packageName. Successful registrations take precedence over same-name failures. All-failed or empty Workflow collections still return diagnosable environments. Workflow loading uses the declarations in intloom.yaml and the isolated .intloom/workflows installation. Failures after Run creation return failed RunView through Runtime.

## Files and validation

- contracts.ts: InitializeProjectOptions, ProjectExecution, WorkflowView, ExecutionReadiness.
- prepare-execution.ts: entry policy, readiness, and service preparation before creating a Run.
- initialize-project.ts: checks, Loader, and Runtime composition using borrowed host resources.
- execution.ts: coordination functions and Workflow diagnostic projections.
- check-project.ts / load-config.ts / schemas/: project checks, configuration loading, and configuration Schemas.
- Blueprint, RunView, and JSON types belong to ../workflow/blueprint.ts, ../runtime/run-view.ts, and ../shared/json.ts; Core composes them.

Source tests cover configuration, canonical paths, repeated initialization, isolation, failed-package diagnostics, successful-registration precedence, and resource ownership. Built-entry integration tests cover loading, waiting, answering, and stopping. Declarations verify environment arguments, required actionId, StorageHandle access boundaries, and removal of old Kernel/CreateKernel exports. These tests do not use live models, clients, or persistent backends.

## Execution preparation

`flow(execution, flowName, intent, source = "cli")` passes the trusted entry source to Runtime. The project Runtime also applies preparation to direct `runtime.flow` calls. Before allocating a Run, it resolves the executor, checks local prerequisites, and prepares only Agents referenced by the target Blueprint. CLI/Studio require llms; Agent IDEs use the client policy when useMcpAgent is true. Missing required service credentials return INVALID_REQUEST. Client Agent Steps publish pendingAgentCall and use the shared claim/Tool/completion API without preparing service models. Code-only client Workflows also run without models.

RunState.execution is fixed at creation; RunView.execution is a detached projection. Queries, answers, and cancellation from another entry do not change it. Optional initialization signal prevents new Run admission if the host stops during asynchronous preparation. Hosts still cancel existing Runs explicitly.

listWorkflows(execution, source) separates resource isAvailable from readiness (source, agentExecutor, status, optional safe error). available means local prerequisites, not remote model connectivity or completed assembly. Prepared instances and concurrent preparation Promises are private to one project's service implementation. Configuration changes require a host restart.

## Host logging

`initializeProject(projectRoot, { storage, effector, logger? })` accepts the shared Utils Logger and passes it to Runtime and Workflow initialization. When omitted it inherits `getLogger()`, which is silent outside an asynchronous log scope. Core does not open files or configure terminal output. The CLI owns the log handle for the service lifetime and stops accepting work after a write failure.
