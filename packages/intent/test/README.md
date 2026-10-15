# Intent validation

Use Bun for repository tasks and Node.js 26.4.0+ for tests. Build first to refresh compiled dependencies:

```sh
bun run build --filter=@intloom/intent
bun run --cwd packages/intent typecheck
bun run --cwd packages/intent test
bun run --cwd packages/intent test:intg
```

`stages/**/*.spec.ts` and `src/**/*.spec.ts` check the business boundaries using explicit in-memory capabilities and queued user replies. They cover immutable handoffs, revisions, coverage, candidate integrity, partial delivery, evidence interpretation, collection decisions and accumulated results. These are not real-model executions.

`test/*.intg.ts` checks the built Loom loader and actual File/SQLite publication, including reopen and retry after post-commit cleanup failure. `test/package/package.intg.ts` checks compiled resources and exported declarations. `test/package/packed-package.intg.ts` checks installed archives; its repository pack prerequisites must be prepared before running `test:package`.

The existing `test` script also includes legacy E2E-checker unit tests. Running those unit tests does not execute an Intent E2E case. The E2E harness and two-round real execution are explicitly outside this refactor's current scope and have not been migrated to this contract.

Design and verification boundaries live in the adjacent vault's `current/intent/` directory. CLI tests use generic Loom fixtures, not Intent business cases.
