# Compiler tests

Run from the repository root; tasks prepare their build/pack dependencies:

```sh
bun run test --filter=@intloom/compiler
bun run test:intg --filter=@intloom/compiler
bun run test:package --filter=@intloom/compiler
```

Source tests live beside their implementation, compilation integration in `test/*.intg.ts`, and archive/declaration consumers in `test/package/*.intg.ts`.

Internal design and coverage responsibilities are maintained in the adjacent intloom-vault repository: [repository testing](../../../../intloom-vault/current/development/testing.md).
