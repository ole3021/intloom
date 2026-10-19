# Kernel tests

Run from the repository root with the installed Node.js runtime:

```sh
bun run typecheck --filter=@intloom/kernel
bun run test --filter=@intloom/kernel
bun run test:intg --filter=@intloom/kernel
```

The root tasks build required dependencies. Integration also builds Kernel. Models are controlled fixtures; service tests open temporary localhost listeners. No E2E suite is invoked.

| Location | Test boundary |
| --- | --- |
| `src/host/**/*.spec.ts` | Configuration, preparation and checkpoint file publication |
| `src/runtime/**/*.spec.ts` | Admission, routing, State, Call ownership, interaction, observation and recovery validation with injected execution/storage |
| `src/execution/**/*.spec.ts`, `src/access/**/*.spec.ts` | Code/Tool validation, capability bindings, credentials and classified errors |
| `src/operations/**/*.spec.ts` | Receipt ledger, query projection/logging and observer lifecycle |
| `src/loom`, `src/mirror`, `src/transport` specs | Loading rules, mirror scope/path/write gates and interaction adapters |
| `runtime.intg.ts`, `package-contracts.intg.ts` | Built Host/Operations/Storage entries and declarations without source path mappings |
| `operations-runtime.intg.ts`, `project-*.intg.ts`, `execution-policy.intg.ts` | Host composition and Operations admission against Runtime |
| `delegated-*.intg.ts`, `access-lifetime.intg.ts` | Delegated Agent ownership, receipts and actual Tool capability lifetimes |
| `executor-*.intg.ts`, `executor.intg.ts`, `model-*.intg.ts` | Model adapters, Tool dispatch, output, diagnostics, timing and Runtime integration |
| `runtime-recovery.intg.ts`, `recovery.intg.ts` | Checkpoints across Runtime instances and separate Node processes |
| `storage*.intg.ts`, `mirror.intg.ts`, `service-*.intg.ts` | Persistence, mirror branches and process/HTTP lifecycle |

`runtime-fixture.ts` provides topology, controlled Code and Storage. `access-fixture.ts` binds capabilities without constructing a model. `executor-fixture.ts` replaces only model responses while retaining the real Agent framework. `storage-contract.ts` runs the same contract against File and SQLite; backend-specific failure tests remain separate.

`createRuntimeHarness` is test convenience: `run`, `answerAsk` and Agent completion methods wait for a stable snapshot. Its `engine` retains the production mutation API. Admission and submission receipt tests use that raw API directly. `operations-harness.ts` composes the actual Host ports, receipt ledger and Operations entry for source integration.

Use `waitForRun` for a waiting/terminal snapshot. Use `waitForSettledRun` when comparing complete terminal/paused snapshots or checking all accepted effects; a human or delegated wait is not settled. Deferred promises synchronize controlled activity. Timeouts bound failures rather than establish readiness.

The case-collision filesystem test skips only when the volume cannot create two names differing by case. Local results do not establish live provider quality, E2E behavior or registry publication.
