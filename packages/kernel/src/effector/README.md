# Effector: Code and Agent execution

N7.1 implements the standard Effector. Hosts create and inject it through the package entry. Runtime binds capabilities, owns state and routing, and Effector executes existing Code/Agents without loading Workflows or storing Runs/clients.

```ts
import { createEffector, initializeProject } from "@intloom/kernel";

const execution = await initializeProject(projectRoot, {
  effector: createEffector({ maxAgentSteps: 10 }),
  storage: storageHandle.access,
});
```

maxAgentSteps is a positive safe integer, default 10. `serviceModelObserver` optionally gates every service model request with an awaited `beforeStep` and observes finite known input/output usage after its response. The host owns its policy and asynchronous Run scope; the observer receives no prompts, State, credentials or model framework instances. A thrown gate blocks the next request; it adds no retry, replay or Core budget. External MCP client reasoning and Tool-owned network calls are outside this service-model observer. It limits service model iterations per Agent call, not total Workflow Steps or IDE reasoning. Hosts may inject custom Effectors and own StorageHandle creation/disposal. File/SQLite adapters are implemented in N7.2.

## Capabilities and responsibilities

| Object | Responsibility |
| --- | --- |
| Runtime | RunState/current Stage State, call ownership, waiting/answers/stopping, outcome routing |
| Code | State and Storage read/write, interaction, signal; deterministic checks and formal commits |
| Agent | Business Tools read/write State, read-only Storage, signal; questions, analysis, drafts |
| Effector | Invoke Code/assembled Agents, bind RequestContext, validate results, propagate errors |
| Host | Retain ProjectExecution, present pendingAction, submit answers with actionId, select/release external resources |

Actual Agent access excludes interaction and storage.commit. This is a capability contract for cooperative code, not a sandbox for arbitrary Workflow modules; authors must respect it.

Stage State holds business questions, answers, and processing results. RunState.pendingAction holds only the currently awaited action. Kernel neither infers business fields nor automatically converts business questions to actions.

```text
Agent Tool saves questions to Stage State → outcome routes to Question Code
Question Code reads questions → awaits interaction.askQuestions → Runtime waiting → host presentation
answerAsk(runId, actionId, answer) → original Question Code resumes → saves replies → outcome
Workflow routes to Agent → a new Agent call reads updated State
```

Question/Clarify/Confirm are ordinary Code Steps. The preceding Agent call has completed; only the Code Promise remains pending during interaction. Answers continue that Code without replay or resuming the prior Agent. There is no standard Agent question Tool, Kernel Step, or Workflow Hook.

## Agent invocation context

The service implementation creates independent Mastra RequestContext, binding {state,storage,signal} under intloom.execution. A privately cached service Agent may serve multiple Runs; AgentRegistry itself stores LoadedAgent resources. Tool modules must not keep global context; call completion clears the container and revokes capabilities.

Workflow Tools use SDK `defineAgentTool` with `execute(input, access)` and required input/output Schemas. `agent-tool.ts` applies their original parsers once, checks cancellation, and latches capability failures even when business code catches them. Its JSON result is shared by service and client execution. The service adapter uses `getAgentExecutionAccess` internally; Workflow Tools do not import RequestContext.

Service Tool transport uses a Standard JSON Schema adapter with SDK strict rewriting disabled. Provider compatibility rewriting must not close dictionary objects, remove recursive JSON values, or require optional fields that the original Workflow Schema permits to be absent. The transport Schema stays identical to `agentJsonSchema`; the original Zod parser still runs once in `executeAgentTool`. Final Agent output remains strictly validated against its original Workflow Schema.

Service model requests identify the client as `intloom/VERSION`. For an `opencode.ai` endpoint, each Agent invocation also supplies a fresh opaque `x-opencode-session` value that remains stable across its model requests, following Zen's routing/cache contract. These headers contain no project paths or credentials and do not change the Workflow's model, Tool or output schema.

Client execution retains the Agent Promise in Runtime and exposes task instructions, Skills, Tool JSON Schemas and attachment IDs through MCP. Business functions and capabilities remain in the host. Each client Tool receives a separate access scope, revoked when the Tool returns. Final Agent output passes through the same `execute-agent.ts` validation as service output.

Service `toolCallConcurrency:1` and the client BUSY/receipt gate serialize Tools within a call. Each Tool must await its State/Storage/external operations. Different Runs may execute concurrently; Storage revision handles formal Artifact conflicts.

Workflow Tools may opt into `endsAgent(parsedOutput)`. Only a validated result that returns `true` closes business Tools in that invocation. Service `prepareStep` then advertises only its local outcome-completion Tool and selects that Tool explicitly; client execution preserves existing receipt retries and rejects new business Tool calls with `INVALID_REQUEST`, leaving explicit completion available. A new Agent invocation gets fresh control. The host never interprets `saved`, derives an outcome or treats a submission as Stage success. Failed Tools, invalid results, cancellation and invalid outcomes retain their existing failure boundaries. The predicate runs in the trusted host and must have no side effects.

## Results, errors, and cancellation

Code may be synchronous or asynchronous; strict StepResult accepts only {outcome:string}. Agents receive a generic execution instruction and null input; business data comes from Stage State through Tools, without input binding or Intent-specific prompt assembly.

Convert the Agent's Zod output Schema to input-shape draft-7 JSON Schema for SDK requests/validation. Remove ~standard validation so the SDK does not apply original Zod transforms prematurely. Mastra may emit text alongside a Tool call, so service execution tolerates intermediate structured-output warnings but accepts an outcome only from the final stop step’s own complete JSON text (including a complete `json` code fence or one unambiguous trailing JSON value after narration). Multiple values, truncated values and text after the value fail. It never reuses the SDK’s cached object from an earlier Tool round. Validate that final value with original Zod safeParseAsync once, then strict StepResult. Invalid or empty final JSON fails as AGENT_OUTPUT_INVALID; unconvertible Schemas fail; Runtime validates outcome routing. This adapter is tied to the pinned Mastra 1.67 behavior and should be rechecked on SDK upgrades.

The final output Schema is explicitly injected into system instructions. It is not placed in the latest user message based on SDK model-name capability guesses. Drafts and submissions still belong to business Tools; their successful return never substitutes for the final outcome.

Each Service invocation has a local `intloom_complete_step` Tool using the output Schema's input shape. Its name is suffixed on collision with a Workflow Tool. It captures the model's actual outcome, closes business Tools and stops the SDK loop without another model request. The original output Schema still runs exactly once in the Effector, followed by Runtime StepResult/routing validation. This completion Tool has no State/Storage write capability and is not added to Workflow declarations or MCP business Tool lists. A valid captured completion may end with `tool-calls`; truncation, errors and cancellation still fail. Complete final text remains a compatibility path; earlier cached SDK objects and business receipts never authorize an outcome.

An opened provider stream must contain an explicit finish reason. A graceful EOF with no finish, or an unknown finish synthesized by the SDK, fails before another model request. Partial Tool JSON from that stream cannot become an argument-repair loop. Timing logs retain `providerFinishReason` separately from the SDK Step reason; accepted earlier operations are preserved and never replayed.

Model execution must end with a complete stop response or an actual local completion submission. Truncation, exhausted budgets, and unfinished Tool loops cannot count as success. A length finish reports the output limit; a Tool-call finish at maxAgentSteps without completion reports the exhausted model-step budget. An error finish without a classified SDK cause remains a Step failure with an explicit finish-reason message. Do not replay Code, Tools, or entire Agent Steps. Model transport/Processor retries are disabled, as are SDK approval/suspension continuations. Business Tool input validation may be corrected within the same Agent call. Invalid completion arguments fail as AGENT_OUTPUT_INVALID. Business execute exceptions or State/Storage access failures terminate it; swallowed access errors still cannot become success through a later outcome. Business questions belong in State followed by an outcome.

Use Utils LoomError/defineErrorCatalog. ../errors/runtime.ts owns codes/default messages; errors.ts recognizes external exceptions without introducing another Error class. LLM_REQUEST_FAILED reports recognized request errors and validated HTTP status; LLM_RESPONSE_INVALID covers protocol/response parsing; AGENT_OUTPUT_INVALID covers final JSON parsing and SDK/original Zod Agent output validation; final StepResult violations remain STEP_RESULT_INVALID. Tool execute or bound State/Storage failures become TOOL_EXECUTION_FAILED. Already classified Runtime errors retain classification; unknown Agent errors fall back to STEP_EXECUTION_FAILED.

Messages contain only recognized status codes, Tool names, known dependency codes, and bounded Schema paths. Never forward SDK messages, request URLs/headers/bodies, response bodies, or custom Zod messages. Original cause chains remain internal in failed RunState. RunView projects the primary code/message/retryable and Cursor; a provider hint never replaces that error. A Tool's own external requests remain Tool failures rather than model failures. New classes default retryable=false, reject SDK retry suggestions, and preserve cancellation/late-result rules. Effector writes no RunState; Runtime owns the final classified failure event.

An original host Tool input parse rejection is privately marked before `execute` begins. Service hooks allow only that marked rejection to return to the current model for correction, aligning client behavior. Kernel feedback lists bounded declared Schema fields and issue codes, excluding values, custom messages and dictionary keys. An `INVALID_REQUEST` thrown from Tool execution or a capability is not this marker and still terminates; classification by error-code text alone is insufficient. SDK transport-shape rejections may also be corrected, while original host refinement rejection uses `tool_input_rejected` telemetry. Neither path replays successful Tools or retries an opened model response.

Debug logs from the current Utils log context expose only these execution summaries:

| Event | Safe fields |
| --- | --- |
| `agent_started` / `agent_completed` / `agent_stopped` | Model-step limit; total elapsed `durationMs`, completed model-step count and Tool-call count on completion or cancellation |
| `model_step_started` / `model_step_completed` / `model_step_failed` / `model_step_stopped` | `modelRequestId`, step number, model ID; provider-stream `durationMs` on termination; completed SDK steps additionally include `stepDurationMs`, allowlisted finish reason, byte counts, finite known input/output usage and optional `reasoningTokens` / `cachedInputTokens` |
| `tool_started` / `tool_completed` / `tool_failed` / `tool_stopped` | Tool name, call number, `toolCallId`, `modelRequestId`, model step; argument count or `durationMs`; classified failure code when known |
| `agent_tools_closed` | Declared Tool name whose validated result closed this invocation; no result value |
| `tool_input_rejected` | Tool/call/request identity, model step, elapsed duration and INVALID_REQUEST; no arguments or values |
| `agent_failed` | Primary `errorCode`, allowlisted `finishReason`, total `durationMs`, model-step/Tool-call counts, latest model request ID when admitted, and when recognized: `sdkErrorId`, `httpStatus`, `transportCode`, `providerFailureReason`; optional `observedErrorSource` |

Timings use the monotonic clock in milliseconds. Model `durationMs` starts immediately before the resolved provider adapter's `doStream` call and ends when IntLoom reads its finish chunk (or EOF); it includes connection and generation time, excluding local Tool execution and host admission gates. `stepDurationMs` measures the admitted SDK iteration through its step callback, including its Tools and SDK processing, so it must not be used as model latency. Tool `durationMs` spans the SDK's before/after Tool hooks after admission, including Tool input validation and execution, excluding observer callbacks. Agent `durationMs` spans the service Agent stream and final parsing; it includes all model rounds, Tools, SDK processing and awaited host policies. These times overlap and must not be summed as independent costs. Usage is not a billing total.

Model starts are emitted only at the actual provider call, after admission succeeds. Each emitted start has one terminal event; failures and cancellation retain the same model/Tool identity. Cancelled durations describe elapsed time until cancellation was observed, not eventual completion of external work that ignores its signal. Late results cannot produce a second terminal log. A successful provider response can have a `model_step_completed` event even if a subsequent Tool or final Agent validation fails; only `agent_completed` denotes the accepted final service result. Unknown usage/finish details are omitted rather than invented. External MCP client model latency is not visible to the service and is not reported as zero. `modelRequestId` correlates iterations without replacing the inherited transport `requestId`, Run, Stage, Step or execution identity.

On stream failure, `observedErrorSource` is `on_error` or `stream_error` only when the SDK supplied an additional error through its callback or stream result. Its recognized fields may fill missing diagnostics, while the caught cause takes precedence and alone determines the primary Runtime error. Tool failures suppress model diagnostics. The raw callback/stream error is never logged. This is tied to the pinned Mastra 1.67 API and must be rechecked on upgrade.

`providerFailureReason` is an optional diagnostic category, not a new public error code or proof of account root cause. Its finite values are `CONTEXT_LENGTH_EXCEEDED` (request context), `INVALID_API_KEY` (credential rejection), `INSUFFICIENT_QUOTA` (quota), `MODEL_NOT_FOUND` (model availability), `RATE_LIMIT_EXCEEDED` (rate limit), and `MODEL_ACCESS_DISABLED` (the exact observed 403 model-access message). They come only from allowlisted `error.code` values in provider JSON response bodies of at most 8 KiB, or that exact 403 message. Unknown reasons are omitted; an unrecognized 403 advises checking model availability and workspace access without asserting why access failed. `httpStatus`, `sdkErrorId` and `transportCode` are likewise present only when recognized. Token counts are provider usage signals, not billing totals; `outputTokens` is not assumed to exclude reasoning, and missing cache/reasoning values are not reported as zero.

Service Agents use `Agent.stream()` and await `getFullOutput()` internally, so supported providers send streaming HTTP responses while IntLoom still exposes only the complete validated outcome. This avoids holding a non-streaming response open through a long generation; it does not guarantee gateway availability or remove network timeouts. Tool ordering, cancellation, model-step budgets, strict final-step validation and disabled retries remain the same. Partial text and reasoning are never treated as successful results or logged.

Safe model-step summaries include text byte counts. `agent_final_output` records final-round text/content byte counts and whether the SDK has a structured object, without recording any output values. A cached SDK object never substitutes for a missing or invalid final-round outcome.

`agent_output_rejected` records validation codes, total root-field counts, and only allowlisted protocol field names. Unknown field names and all values are omitted. This distinguishes a returned draft, Tool result, or Schema from the required outcome without storing model content.

Host project commands return a failed command result when no child could start: exit 126 for a missing/non-directory requested cwd, and 127 for ENOENT with no child PID while the canonical project root remains intact. Agents may correct command/args/cwd in-call; this never replays a process. Permission, path-boundary, project-root loss and cancellation errors still throw and terminate capability execution.

Inputs, model outputs, request URLs/headers/bodies, response bodies, credentials and raw SDK exceptions never enter these execution logs. The pinned Mastra SDK can otherwise print raw structured-output values on stream failure, so assembled service Agents use its noopLogger and a private Mastra 1.67 ephemeral context (`logger:false`, `__ephemeral:true`) that also suppresses internal workflow loggers. This matches the SDK standalone in-memory context without taking ownership of IntLoom business Storage or adding durable SDK recovery. IntLoom owns the safe failure log. Recheck that adapter when upgrading Mastra. For support, inspect the Run's primary error with the preceding step and Tool events using [CLI debug logs](../../../../apps/cli/README.md#results-and-logs). An HTTP 200 response alone does not establish a valid Agent outcome or Intent Workflow completion.

Runtime creates AbortController per initializer/Step; access.signal is read-only. stop revokes ownership, publishes RUN_STOPPED, rejects pending answers, then signals cancellation. Standard Agent passes the signal to model requests. Code/Tools may pass it to supporting APIs. Normal completion also revokes old capabilities; the next call gets a fresh signal.

Cancellation is cooperative. stop returns immediately without waiting for or rolling back external operations. Operations ignoring the signal may continue, but late results/stale access cannot overwrite terminal state. Storage methods currently accept no signal, and adapters own started writes; cancellation does not forcibly undo them.

## Files and validation

- create-effector.ts: public factory and minimal policy.
- execute-code.ts: Code invocation and result validation.
- execute-agent.ts: generic dispatch through ExecutableAgent.execute; no model framework types.
- ../core/prepare-execution.ts: trusted entry policy, readiness, and preparation before Run creation.
- service/prepare.ts: configuration/credential checks, concurrent model preparation and per-project cache.
- service/credentials.ts: ENV startup precedence and project-only plain .env fallback shared by readiness and assembly; DENV remains externally decrypted.
- service/create-agent.ts, agent-model.ts, agent-skills.ts: Mastra-specific assembly.
- service/execute-agent.ts: model calls, transport shape checks, errors and cleanup; original Agent output validation lives in execute-agent.ts.
- errors.ts and service/errors.ts: generic Tool/result errors and service model/Agent errors, respectively.
- service/agent-context.ts: framework bindings; agent-context.ts owns the private stateless binding accessor and its validation.
- contracts.ts / execution.ts: interfaces, executable resources, access, StepResult.
- state-access.ts / interaction.ts: business capabilities bound by Runtime without scheduling state.
- schemas/: strict StepResult and question/confirmation request/reply Schemas.

Unit tests use actual Mastra Agent/Tool engines with controlled models and cover serial Tools, two-Run isolation, Agent → Question Code → answer → new Agent loops, single transform application, Tool/Storage/model failures, budgets, cancellation, and late results. Built-entry integration loads compiled Workflows via initializeProject, executes controlled OpenAI-compatible requests, and checks signal, read-only Storage, and absent Agent interaction in declarations.

These tests prove SDK execution and Kernel wiring. N7.2 persistence and N7.3 complete Intent combinations are separately verified using standard execution, actual business Tools, and both formal backends, with controlled models/answers. Live model quality and CLI/MCP UI require independent validation; see the [Intent report](../../../../design/kernel/intent-integration-report.md). SDK references: [Agent.stream](https://mastra.ai/reference/streaming/agents/stream), [RequestContext](https://mastra.ai/docs/server/request-context), [Tools](https://mastra.ai/docs/agents/tools).
