# Loom initialization

Protocols 2026-10-27 and 2026-10-27.1 packages expose definition/plan/bindings. The capability adapter validates and maps their plan into the existing Runtime; legacy 2026-10-15 packages continue through the original loader using blueprint/codes/agentSpecs. Both use exactly three named ESM exports. See [Loom Package 0.10](../../../../docs/guide/reference/loom-package.md).

The loom module uses ordinary functions. `@intloom/kernel/loom` exports initializeLooms, discoverLooms, loadLoom, and their result types. Host initializeProject invokes this pipeline after configuration validation; see [Host](../host/README.md).

Initialization loads only config.looms from .intloom/looms/, checking declared package names and versions. An omitted declaration list is empty; root business dependencies are not scanned. The CLI verifies/restores the installation before calling Kernel; Loader performs no installation or archive checks. Initialization proceeds sequentially by declaration. Each Loom loads, validates its resources, and registers independently, without reading model credentials. Failures become isAvailable:false results while other packages continue. Only complete successes contribute resources. There is no disposal record or unified release interface.

## Calls and results

```ts
import { initializeLooms } from "@intloom/kernel/loom";

// Configuration is already validated; the loader does not reload it.
const { registries, looms } = await initializeLooms({ projectRoot, config });
for (const loom of looms) {
  if (loom.isAvailable) {
    console.log(loom.loomName);
  } else {
    console.error(loom.packageName, loom.phase, loom.error);
  }
}
```

LoomInitializationOutcome is a boolean-discriminated union:

`LoomInitializationPhase` covers discovery, module loading, Agent resource preparation, and registration. `LoomInitializationFailure` is a per-package failure; `LoomInitializationResult` groups per-package outcomes with the completed registries. `LoadedLoom` specifically denotes a loaded module.

```ts
type LoomInitializationOutcome =
  | { packageName: string; loomName: string; isAvailable: true }
  | {
      packageName: string;
      loomName?: string;
      isAvailable: false;
      phase: "discover" | "load" | "agent" | "register";
      error: LoomError;
    };
```

loomName is known only after module loading succeeds, so discover/load failures may omit it. Existing LoomErrors are preserved; other exceptions retain their cause. Individual dependency resolution, protocol, or artifact failures remain package-level. All-failed initialization returns empty registries with diagnostics; no Looms returns empty registries and results. Standalone discoverLooms can inspect an installation manifest when no declarations are supplied; manifest read/parse failures then propagate to its caller.

## Data and functions

`@intloom/loom-sdk` defines Blueprint, Stage initialization, compiled Loom modules and Agent/Skill specifications; [registries.ts](./registries.ts) defines loaded resources; [types.ts](./types.ts) defines options/results. Execution owns executable Code/Agent contracts. [index.ts](./index.ts) only exports APIs; [initialize-looms.ts](./initialize-looms.ts) orchestrates packages. Agent model/credential resolution is in [agent-model.ts](../execution/model/agent-model.ts), directory/inline Skill handling in [agent-skills.ts](../execution/model/agent-skills.ts), and model construction in [model/create-agent.ts](../execution/model/create-agent.ts). These run only during service preparation, before Run creation. Startup validates packaged Skill metadata through validate-agent-resources.ts.

| Data | Meaning |
| --- | --- |
| LoomPackage | Package/npm/protocol versions, actual directory, entry URL, asset root |
| AgentSpec / SkillSpec | Compiler assembly definitions with actual Tool and Zod object references |
| LoadedLoom | Three exports and source after structure, reference, and asset checks |
| LoadedAgent | Global Agent ID, validated spec and package source; no model instance |
| LoomDiscoveryResult | Loadable sources and package failures |
| LoomInitializationResult | Registries and per-Loom availability |
| LoomRegistries | Resources indexed by loomName/CodeId/AgentId and sources by loomName |

| Function | Responsibility |
| --- | --- |
| discoverLooms | Inspect declared packages or an installation's direct dependencies; check metadata/protocol/entries |
| loadLoom | ESM import, validateLoom, file existence and asset path checks |
| validateLoom | Pure structure, entry, routing, and package-local execution-reference validation |
| validateAgentResources | Validate Skill uniqueness and packaged metadata without models |
| registerLooms | Validate conflicts and Agent completeness in new tables; preserve old tables on failure |
| initializeLooms | Orchestrate phases and convert package failures to unavailable results |

## Loading and registration rules

- Initialization discovers declared packages only, excluding transitive and business dependencies. Standalone manifest inspection skips ordinary packages without loom metadata. Deduplicate actual manifests. Looms must export ./package.json and use protocol 2026-10-15 exactly, independently of npm version.
- Resolve compiled .js/.mjs through types/default/import exports; import and default must match. assetRoot is the actual entry directory, typically local dist or the installed package root. Check actual files and real paths without escaping the boundary.
- ESM import evaluates top-level definitions. Loader does not parse source YAML, call Compiler, or execute Code/Tools/models for validation. The protocol supports Code/Agent Steps and is aligned with SDK; no Hook or Kernel Step is provided. When the installed Loom resolves a distinct Utils copy, Loader binds the host's current Logger into that copy for each Code invocation, its existing recovery entry, and Agent Tool `execute` call. This is a call-time adapter; loading never invokes Code or Tools. The adapter preserves synchronous returns, promises, exceptions, and function receivers; ordinary Tool method calls retain the original Tool receiver. Same-copy or missing Utils leaves Code and Tool functions unchanged; an installed Utils without its logger context API makes that Loom unavailable. Schemas, Skills, initializers, and other callbacks are outside this bridge.
- Validate package-local references, validate every Agent resource, then register. Loom/Code/Agent conflicts preserve earlier successful packages and reject the later package entirely. Dependency order determines initialization order; failed packages reserve no IDs.
- Registration uses local new tables and publishes only after complete checks. Any failed, missing, or incomplete Agent excludes that package's Blueprint, Code, and other Agents from final registries.

## Service assembly boundaries

- Supported roles are thinking/working/coding; missing dedicated configuration falls back to default. Unknown roles fail; callers validate configuration first.
- ENV.NAME reads process.env first; only undefined variables fall back to the canonical project's regular .env file, parsed with Node's dotenv parser. No ancestor, working-directory, variant or symlink files are loaded. The per-project file snapshot is lazy and retained until restart, without mutating process.env. DENV.NAME still requires external startup decryption, such as dotenvx. Missing/blank/encrypted required values fail service preparation before Run creation without exposing credentials. They do not make Loom resources unavailable.
- OpenAI-compatible models use Mastra model name, credential, and optional endpoint configuration. Anthropic uses the native SDK and optional baseURL. Pass temperature, maxOutputTokens, topP, and SDK-compatible providerOptions.
- Tools are assembled by ID with duplicate checks. Skills retain artifact order and unique names. Asset-bearing Skills use the actual directory containing SKILL.md and preserve relative references; others are inline. Startup checks Skill files, names and descriptions independently of the SDK. Service preparation additionally checks SDK assembly completeness.
- The private ServiceAgent retains outputSchema; its implementation converts it to request JSON Schema and returns the raw result; common executeAgent validates the original Zod Schema once. Assembly receives no Run State. Runtime binds State/Storage/signal and Code interaction per call; Execution creates independent Agent RequestContext. SDK Agent Tools receive explicit access, have no interaction, and extract business context from State. Only the private service wrapper reads intloom.execution; client execution uses the same Tool contract through Runtime. See [Execution](../execution/README.md). Availability does not prove remote connectivity or model quality.

## Validation

From the root, run bun run check/test/test:intg with --filter=@intloom/kernel --filter=@intloom/intent.

Unit tests cover structure/references, direct discovery, actual assembly, role defaults/settings, duplicate resources, and atomic registration. Anthropic request tests replace fetch to verify native endpoints without networking.

Kernel integration tests consume built exports and cover local dist/installed root layouts, corrupt exports/assets, failure isolation, resource validation failures, all three conflict categories, and all-failed collections. Intent additionally installs actual tarballs without repository source or Compiler, loads resources, and checks published declarations and isAvailable narrowing.

Loader tests prove model-independent discovery, resource validation, and registration. Service tests separately prove framework assembly. Runtime/Host separately verify scheduling, isolation, and in-process answers; clients, persistence, and model execution are outside Loader proof.

## Stage initialization

Every internal BlueprintStage requires initializeState. For legacy protocol 2026-10-15, Compiler delivers the function from state.initialize's relative TypeScript resource reference; Loader checks callability without invoking it or creating business State. Older artifacts missing this field must be rebuilt. For protocol 2026-10-27, the adapter supplies the Stage initializer from the compiled capability contract; authors do not declare internal Stage State or routing outcomes.
