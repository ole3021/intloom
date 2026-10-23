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

The `test` script also includes E2E-checker unit tests. The CMD/MCP harness and S01/M01 cases use the current Loom contract, with controlled-provider coverage in CLI integration tests. These checks do not execute real-model Intent cases. Real-model and two-round acceptance require fresh E2E runs and retained reports; see [E2E usage](../../../apps/cli/src/e2e/README.md).

Design and verification boundaries live in the adjacent vault's `current/intent/` directory. CLI tests use generic Loom fixtures, not Intent business cases.
