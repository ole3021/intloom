# Effector: Code and Agent execution

N7.1 implements the standard Effector. Hosts create and inject it through the package entry. Runtime binds capabilities, owns state and routing, and Effector executes existing Code/Agents without loading Workflows or storing Runs/clients.

```ts
import { createEffector, initializeProject } from "@intloom/kernel";

const execution = await initializeProject(projectRoot, {
  effector: createEffector({ maxAgentSteps: 10 }),
  storage: storageHandle.access,
});
```

maxAgentSteps is a positive safe integer, default 10. It limits service model iterations per Agent call, not total Workflow Steps or IDE reasoning. Hosts may inject custom Effectors and own StorageHandle creation/disposal. File/SQLite adapters are implemented in N7.2.

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

Client execution retains the Agent Promise in Runtime and exposes task instructions, Skills, Tool JSON Schemas and attachment IDs through MCP. Business functions and capabilities remain in the host. Each client Tool receives a separate access scope, revoked when the Tool returns. Final Agent output passes through the same `execute-agent.ts` validation as service output.

Service `toolCallConcurrency:1` and the client BUSY/receipt gate serialize Tools within a call. Each Tool must await its State/Storage/external operations. Different Runs may execute concurrently; Storage revision handles formal Artifact conflicts.

## Results, errors, and cancellation

Code may be synchronous or asynchronous; strict StepResult accepts only {outcome:string}. Agents receive a generic execution instruction and null input; business data comes from Stage State through Tools, without input binding or Intent-specific prompt assembly.

Convert the Agent's Zod output Schema to input-shape draft-7 JSON Schema for SDK requests/validation. Remove ~standard validation so the SDK does not apply original Zod transforms prematurely. Validate final output with original Zod safeParseAsync once, then strict StepResult. Unconvertible Schemas fail; Runtime validates outcome routing.

Model execution must end with a complete stop response. Truncation, exhausted budgets, and unfinished Tool loops cannot count as success. Do not replay Code, Tools, or entire Agent Steps. Model transport/Processor retries are disabled, as are SDK approval/suspension continuations. Tool input validation may be corrected within the same Agent call. Business execute exceptions or State/Storage access failures terminate it; swallowed access errors still cannot become success through a later outcome. Business questions belong in State followed by an outcome.

Use Utils LoomError/defineErrorCatalog. ../errors/runtime.ts owns codes/default messages; errors.ts recognizes external exceptions without introducing another Error class. LLM_REQUEST_FAILED reports recognized request errors and validated HTTP status; LLM_RESPONSE_INVALID covers protocol/response parsing; AGENT_OUTPUT_INVALID covers SDK/original Zod Agent output validation; final StepResult violations remain STEP_RESULT_INVALID. Tool execute or bound State/Storage failures become TOOL_EXECUTION_FAILED. Already classified Runtime errors retain classification; unknown Agent errors fall back to STEP_EXECUTION_FAILED.

Messages contain only recognized status codes, Tool names, known dependency codes, and bounded Schema paths. Never forward SDK messages, request URLs/headers/bodies, response bodies, or custom Zod messages. Original cause chains remain internal in failed RunState. RunView projects code/message/retryable and uses the existing Cursor. A Tool's own external requests remain Tool failures rather than model failures. New classes default retryable=false, reject SDK retry suggestions, and preserve cancellation/late-result rules. Effector writes no RunState. Through the current Utils log context it records Agent duration, model-step counts/usage and Tool names/counts/timing; inputs, outputs and raw SDK exceptions are excluded. Runtime owns the final classified failure event. See [error diagnostics](../../../../design/kernel/runtime-error-diagnostics.md).

Runtime creates AbortController per initializer/Step; access.signal is read-only. stop revokes ownership, publishes RUN_STOPPED, rejects pending answers, then signals cancellation. Standard Agent passes the signal to model requests. Code/Tools may pass it to supporting APIs. Normal completion also revokes old capabilities; the next call gets a fresh signal.

Cancellation is cooperative. stop returns immediately without waiting for or rolling back external operations. Operations ignoring the signal may continue, but late results/stale access cannot overwrite terminal state. Storage methods currently accept no signal, and adapters own started writes; cancellation does not forcibly undo them.

## Files and validation

- create-effector.ts: public factory and minimal policy.
- execute-code.ts: Code invocation and result validation.
- execute-agent.ts: generic dispatch through ExecutableAgent.execute; no model framework types.
- ../core/prepare-execution.ts: trusted entry policy, readiness, and preparation before Run creation.
- service/prepare.ts: configuration/credential checks, concurrent model preparation and per-project cache.
- service/create-agent.ts, agent-model.ts, agent-skills.ts: Mastra-specific assembly.
- service/execute-agent.ts: model calls, transport shape checks, errors and cleanup; original Agent output validation lives in execute-agent.ts.
- errors.ts and service/errors.ts: generic Tool/result errors and service model/Agent errors, respectively.
- service/agent-context.ts: framework bindings; agent-context.ts re-exports the stateless SDK accessor.
- contracts.ts / execution.ts: interfaces, executable resources, access, StepResult.
- state-access.ts / interaction.ts: business capabilities bound by Runtime without scheduling state.
- schemas/: strict StepResult and question/confirmation request/reply Schemas.

Unit tests use actual Mastra Agent/Tool engines with controlled models and cover serial Tools, two-Run isolation, Agent → Question Code → answer → new Agent loops, single transform application, Tool/Storage/model failures, budgets, cancellation, and late results. Built-entry integration loads compiled Workflows via initializeProject, executes controlled OpenAI-compatible requests, and checks signal, read-only Storage, and absent Agent interaction in declarations.

These tests prove SDK execution and Kernel wiring. N7.2 persistence and N7.3 complete Intent combinations are separately verified using standard execution, actual business Tools, and both formal backends, with controlled models/answers. Live model quality and CLI/MCP UI require independent validation; see the [Intent report](../../../../design/kernel/intent-integration-report.md). SDK references: [Agent.generate](https://mastra.ai/reference/agents/generate), [RequestContext](https://mastra.ai/docs/server/request-context), [Tools](https://mastra.ai/docs/agents/tools).
