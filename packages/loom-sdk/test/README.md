# Loom SDK tests

```sh
bun run typecheck --filter=@intloom/loom-sdk
bun run test --filter=@intloom/loom-sdk
bun run test:package --filter=@intloom/loom-sdk
```

Source-adjacent specs own SDK structure: fixed input declarations and values, StepResult, typed recovery, interaction shapes, protocol names/IDs and compiled module structure. Invalid cases identify the rejected rule; module validation must never execute business Code, Tools, initializers or Schema parsers.

`fixtures/consumer/sdk.ts` checks inference, readonly capabilities and invalid authoring contracts. `runtime.ts` exercises the installed SDK. `package/package.intg.ts` checks built exports/declarations, then installs the archive without Kernel, Utils or repository links. The package task prepares its build and archive; isolated installation requires registry access for external dependencies.

Runtime ownership, request/answer correlation and execution belong to Kernel tests. Compiler integration verifies that generated Looms satisfy these SDK contracts. No separate SDK execution engine or E2E suite is introduced.
