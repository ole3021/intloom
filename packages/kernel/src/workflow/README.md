# Workflow initialization

The workflow module uses ordinary functions and consumes Compiler-generated named ESM exports blueprint, codes, and agentSpecs. `@intloom/kernel/workflow` exports initializeWorkflows, discoverWorkflows, loadWorkflow, and their result types. Core initializeProject invokes this pipeline after configuration validation; see [Core](../core/README.md).

Initialization loads only config.workflows from .intloom/workflows/, checking declared package names and versions. An omitted declaration list is empty; root business dependencies are not scanned. The CLI verifies/restores the installation before calling Kernel; Loader performs no installation or archive checks. Initialization proceeds sequentially by declaration. Each Workflow loads, validates its resources, and registers independently, without reading model credentials. Failures become isAvailable:false results while other packages continue. Only complete successes contribute resources. There is no disposal record or unified release interface.

## Calls and results

```ts
import { initializeWorkflows } from "@intloom/kernel/workflow";

// Configuration is already validated; the loader does not reload it.
const { registries, workflows } = await initializeWorkflows({ projectRoot, config });
for (const workflow of workflows) {
  if (workflow.isAvailable) {
    console.log(workflow.flowName);
  } else {
    console.error(workflow.packageName, workflow.phase, workflow.error);
  }
}
```

WorkflowInitializationOutcome is a boolean-discriminated union:

`WorkflowInitializationPhase` covers discovery, module loading, Agent resource preparation, and registration. `WorkflowInitializationFailure` is a per-package failure; `WorkflowInitializationResult` groups per-package outcomes with the completed registries. `LoadedWorkflow` specifically denotes a loaded module.

```ts
type WorkflowInitializationOutcome =
  | { packageName: string; flowName: string; isAvailable: true }
  | {
      packageName: string;
      flowName?: string;
      isAvailable: false;
      phase: "discover" | "load" | "agent" | "register";
      error: LoomError;
    };
```

flowName is known only after module loading succeeds, so discover/load failures may omit it. Existing LoomErrors are preserved; other exceptions retain their cause. Individual dependency resolution, protocol, or artifact failures remain package-level. All-failed initialization returns empty registries with diagnostics; no Workflows returns empty registries and results. Standalone discoverWorkflows can inspect an installation manifest when no declarations are supplied; manifest read/parse failures then propagate to its caller.

## Data and functions

[blueprint.ts](./blueprint.ts) defines execution and Stage initialization; [module.ts](./module.ts) defines artifacts and Agent/Skill specifications; [registries.ts](./registries.ts) defines loaded resources; [types.ts](./types.ts) defines options/results. Effector owns executable Code/Agent contracts. [index.ts](./index.ts) only exports APIs; [initialize-workflows.ts](./initialize-workflows.ts) orchestrates packages. Agent model/credential resolution is in [agent-model.ts](../effector/service/agent-model.ts), directory/inline Skill handling in [agent-skills.ts](../effector/service/agent-skills.ts), and model construction in [service/create-agent.ts](../effector/service/create-agent.ts). These run only during service preparation, before Run creation. Startup validates packaged Skill metadata through validate-agent-resources.ts.

| Data | Meaning |
| --- | --- |
| WorkflowPackage | Package/npm/protocol versions, actual directory, entry URL, asset root |
| AgentSpec / SkillSpec | Compiler assembly definitions with actual Tool and Zod object references |
| LoadedWorkflow | Three exports and source after structure, reference, and asset checks |
| LoadedAgent | Global Agent ID, validated spec and package source; no model instance |
| WorkflowDiscoveryResult | Loadable sources and package failures |
| WorkflowInitializationResult | Registries and per-Workflow availability |
| WorkflowRegistries | Resources indexed by flowName/CodeId/AgentId and sources by flowName |

| Function | Responsibility |
| --- | --- |
| discoverWorkflows | Inspect declared packages or an installation's direct dependencies; check metadata/protocol/entries |
| loadWorkflow | ESM import, validateWorkflow, file existence and asset path checks |
| validateWorkflow | Pure structure, entry, routing, and package-local execution-reference validation |
| validateAgentResources | Validate Skill uniqueness and packaged metadata without models |
| registerWorkflows | Validate conflicts and Agent completeness in new tables; preserve old tables on failure |
| initializeWorkflows | Orchestrate phases and convert package failures to unavailable results |

## Loading and registration rules

- Initialization discovers declared packages only, excluding transitive and business dependencies. Standalone manifest inspection skips ordinary packages without intloom metadata. Deduplicate actual manifests. Workflows must export ./package.json and use protocol 2026-10-08 exactly, independently of npm version.
- Resolve compiled .js/.mjs through types/default/import exports; import and default must match. assetRoot is the actual entry directory, typically local dist or the installed package root. Check actual files and real paths without escaping the boundary.
- ESM import evaluates top-level definitions. Loader does not parse source YAML, call Compiler, or execute Code/Tools/models for validation. The protocol supports Code/Agent Steps and is aligned with Core; no Hook or Kernel Step is provided.
- Validate package-local references, validate every Agent resource, then register. Workflow/Code/Agent conflicts preserve earlier successful packages and reject the later package entirely. Dependency order determines initialization order; failed packages reserve no IDs.
- Registration uses local new tables and publishes only after complete checks. Any failed, missing, or incomplete Agent excludes that package's Blueprint, Code, and other Agents from final registries.

## Service assembly boundaries

- Supported roles are reasoning/coding/review; missing dedicated configuration falls back to default. Unknown roles fail; callers validate configuration first.
- ENV.NAME / DENV.NAME read decrypted startup values. dotenvx startup performs DENV decryption. Missing/blank/encrypted required values fail service preparation before Run creation without exposing credentials. They do not make Workflow resources unavailable.
- OpenAI-compatible models use Mastra model name, credential, and optional endpoint configuration. Anthropic uses the native SDK and optional baseURL. Pass temperature, maxOutputTokens, topP, and SDK-compatible providerOptions.
- Tools are assembled by ID with duplicate checks. Skills retain artifact order and unique names. Asset-bearing Skills use the actual directory containing SKILL.md and preserve relative references; others are inline. Startup checks Skill files, names and descriptions independently of the SDK. Service preparation additionally checks SDK assembly completeness.
- The private ServiceAgent retains outputSchema; its implementation converts it to request JSON Schema and returns the raw result; common executeAgent validates the original Zod Schema once. Assembly receives no Run State. Runtime binds State/Storage/signal and Code interaction per call; Effector creates independent Agent RequestContext. SDK Agent Tools receive explicit access, have no interaction, and extract business context from State. Only the private service wrapper reads intloom.execution; client execution uses the same Tool contract through Runtime. See [Effector](../effector/README.md). Availability does not prove remote connectivity or model quality.

## Validation

From the root, run bun run check/test/test:intg with --filter=@intloom/kernel --filter=@intloom/workflow-intent.

Unit tests cover structure/references, direct discovery, actual assembly, role defaults/settings, duplicate resources, and atomic registration. Anthropic request tests replace fetch to verify native endpoints without networking.

Kernel integration tests consume built exports and cover local dist/installed root layouts, corrupt exports/assets, failure isolation, resource validation failures, all three conflict categories, and all-failed collections. Intent additionally installs actual tarballs without repository source or Compiler, loads resources, and checks published declarations and isAvailable narrowing.

Loader tests prove model-independent discovery, resource validation, and registration. Service tests separately prove framework assembly. Runtime/Core separately verify scheduling, isolation, and in-process answers; clients, persistence, and model execution are outside Loader proof.

## N2 Stage initialization

Every BlueprintStage requires initializeState. Compiler delivers the function from state.initialize's @initializers reference; Loader checks callability without invoking it or creating business State. ESM still has exactly three named exports, and initializers are outside CodeRegistry. The development protocol remains 2026-10-08; older artifacts missing this field must be rebuilt.
