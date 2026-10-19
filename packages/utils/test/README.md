# Utils tests

```sh
bun run typecheck --filter=@intloom/utils
bun run test --filter=@intloom/utils
bun run test:intg --filter=@intloom/utils
bun run test:package --filter=@intloom/utils
```

Source-adjacent specs cover Error identity/wrapping, IDs and individual logging modules. `context.spec.ts` checks async context with explicit promise gates. File logger/reader tests use isolated files because file behavior is their module contract; read offsets, partial Unicode, filtering, backpressure and cancellation are separate scenarios.

`logging.intg.ts` composes public context, logger and reader exports, verifies persisted Run identities and checks pino-pretty output. `package/package.intg.ts` checks the built public entry and runtime dependencies. These package checks do not claim an isolated registry install; shared declaration consumers are also exercised by Compiler's package tests.

The root tasks prepare required builds/archives. No live external service or E2E suite is used.
