# Runtime

Runtime is the sole owner of Run status/cursor, current Stage State, Call ownership, waits, route decisions, pause/cancel and recovery. It executes already loaded Blueprints under a frozen Host-prepared policy. It does not load packages, choose models, own protocol connections or deduplicate client operations.

`create-runtime.ts` exposes quick mutation results and snapshot subscriptions. `run-loop.ts` owns scheduling and validated transitions. `stage-state.ts` and its binding keep a new identity per Stage visit. `call-scope.ts` tracks capability uses and delegated activity until they settle, even after revocation. `execution-access.ts` composes narrow Access bindings without leaking `RunEntry` into Access or Execution.

`interaction.ts` / `answer-ask.ts` own human waits; `agent-call.ts` owns only Runtime's delegated-wait boundary. The Agent task/claim/Tool receipts belong to Execution. `run-facts.ts` owns actual commit references and pending activity independently of `run-observation.ts` model metrics and limits.

`recovery/contracts.ts` describes normalized recovery data; `recovery/codec.ts` stores exactly one format-3 boundary; `recovery/checkpoint.ts` decides what to save; `recovery/validate.ts` builds detached validated recovery state without a store or executor; `recovery/restore.ts` attaches persistence before any business execution. Host uses the same validation entry for offline mirror restore. Host supplies the file store. `boundaries.ts` is Runtime's awaited mirror capture adapter.

A Run can be terminal while `settled` is false. Exclusive admission retains the project reservation until tracked work settles; a paused Run retains its reservation. Suspended Runtime instances reject new mutations before changing state or checkpoints. Observers must not assume cancellation rolled back accepted effects. Supported recovery uses a new Call; old Access objects, claims and in-flight closures never become live again. See the [full Kernel contract](../../README.md).
