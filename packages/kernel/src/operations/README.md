# Operations

Operations is the application boundary shared by HTTP, MCP and in-process consumers. It binds a trusted entry source, queries resources, and admits mutations against the Host's current project environment. It does not own RunState, Stage State, Calls, model execution or transport connections.

`createOperations(ports, source)` exposes `admit`, `getOperation`, `findRun` and resource/query operations. Admissions consume Runtime's explicit mutation result; an unknown thrown failure is conservatively indeterminate. Host creates one ledger with `createOperationReceipts(serviceInstanceId)` and shares it through the ports. The ledger owns request hashing, deduplication and receipt lifetime. No adapter keeps another receipt cache.

`admit` is the only Operations entry that starts, answers, pauses, stops or resumes a Run. There are no direct mutation aliases or blocking mutation helpers. Host supplies `OperationsPorts`, not its resource handles or lifecycle API. New admissions check Host availability before invoking Runtime; existing receipts remain queryable during shutdown.

`looms.ts` projects resource diagnostics. Runtime's own start/answer/resume operations are quick admission APIs; `wait-run.ts` separately waits for a snapshot. Disconnecting that observer cannot cancel execution.

Offline mirror preparation belongs to Host. Operations delegates restore through a port; it neither loads resources nor constructs Execution or recovered Run entries.

See [Kernel admission and recovery rules](../../README.md).
