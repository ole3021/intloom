# Compiler tests

Run from the repository root; tasks prepare their build/pack dependencies:

```sh
bun run test --filter=@intloom/compiler
bun run test:intg --filter=@intloom/compiler
bun run test:package --filter=@intloom/compiler
```

Source tests live beside their implementation, compilation integration in `test/*.intg.ts`, and archive/declaration consumers in `test/package/*.intg.ts`.

Artifact verification is grouped by contract: `verify-artifacts.spec.ts` covers entry metadata and output layout, `verify-artifacts-exports.spec.ts` covers runtime bindings and re-export resolution, and `verify-artifacts-dependencies.spec.ts` covers JavaScript/declaration dependencies. They share only the temporary artifact fixture in `helpers/artifacts.ts`. Filesystem and path mocks must be restored before temporary-directory cleanup.

`build-contract.intg.ts` checks SDK compatibility and reproducible output; `compile-loom.intg.ts` consumes generated code, declarations and assets; `compile-failures.intg.ts` preserves prior output and author files under failures. Archive consumers remain under `package/` and require registry access. No model execution or E2E suite is part of these tasks.

Internal design and coverage responsibilities are maintained in the adjacent intloom-vault repository: [repository testing](../../../../intloom-vault/current/development/testing.md).
