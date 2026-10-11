# Kernel Service

This private layer owns one independent Node process per project: discovery/locks, initialization, Runtime, Storage, safe logs, lifecycle and protocol adapters. `entry.ts` is the actual installed child entry. It never imports CLI implementation.

`application/project.ts` binds CLI, Studio and external Agent entry policy to the same project operations. HTTP `/api/v1/cli`, `/api/v1/studio`, `/api/v1/agent` and MCP adapters borrow those operations. Clients never open their own Runtime/Storage. Trusted loopback discovery validates project, PID, instance and address before passing credentials; Host/Origin checks and authentication remain.

`api-contracts.ts`, `contracts.ts` and application schemas own JSON contracts. Ordinary results use safe JSON envelopes. Flow/answer receipts are immutable after acceptance/rejection and retained until instance exit. Canonical object-key ordering deduplicates requests while preserving text/array order/source policy. Instance-bound writes do not retarget a replacement Service.

SSE sends full initial project/Run snapshots, then complete changed objects using Runtime revisions. Backpressure coalesces intermediate snapshots. It is not an audit log. Disconnect closes observers, not execution; Service closing is announced before suspension/resource release.

Run metadata is owned by `runtime/run-observation.ts`, with Effector reporting model/Tool identities and known usage. `execution-limits.ts` only reads Host limits/rates; it is not a second meter. Formal result references come from real StorageCommitResult. Recovery resets instance metadata; business checkpoints exclude it.

Shutdown closes admission, informs observers, suspends Runtime and waits known tasks, then releases protocol/Storage/log/owned locks. Unconfirmed cleanup remains an error; the lifecycle controller never resends stop or removes a new instance's resources. Optional `stopService` instance binding pins the observed target.
