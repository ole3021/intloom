# Execution

Execution executes prepared Code, Code recovery, service Agents and delegated Agent tasks. It validates original input/output Schemas and returns StepResult to Runtime. It never owns Run/Stage state, chooses routes, loads a project, or imports Runtime implementations.

`create-execution.ts` creates an independent executor. `execute-code.ts` validates Code outcomes; recovery validates `CodeRecovery` and calls only the declared `recover` entry. `execute-agent.ts` validates Agent output. `agent-tool.ts` parses Tool inputs/outputs once, binds a child Access lifetime and rejects unfinished capability uses before returning.

`model/` owns provider preparation, credentials, model transport, final-output handling, timing and framework adapters. Host selects the frozen execution policy and prepares resources. Provider streams must contain an explicit finish; truncation or cancellation cannot authorize an outcome or replay accepted Tools. Unknown transport/provider causes stay private while classified errors are projected externally.

`delegated/` owns external Agent tasks, claims, serial Tool calls, assets and Tool/completion receipts. Runtime supplies a `CallScope`, a minimal wait handle and bound Access. Receipts cache the complete Tool operation, including ownership checks, final-submission decisions and cleanup. Concurrent and later retries receive the same final value or failure without replaying effects. Active receipts have a fixed capacity and no eviction. A closing Call retains its receipts for 30 minutes after all tracked activity settles. Successful completion is a submission receipt; callers query the Run separately.

`ServiceModelObserver` carries usage/budget observations, never business State or credentials. These metrics are optional and cannot determine capability authority or whether external work has settled. See [Kernel boundaries](../../README.md).
