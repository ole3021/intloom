# Intent tests

Run from the repository root; tasks prepare their build/pack dependencies and fixtures clean up resources:

```sh
bun run test --filter=@intloom/workflow-intent
bun run test:intg --filter=@intloom/workflow-intent
bun run test:package --filter=@intloom/workflow-intent
```

Source tests live beside their implementation, business integration in `test/*.intg.ts`, and archive consumers in `test/package/*.intg.ts`.

Internal design, fixture responsibilities and coverage boundaries are maintained in the adjacent intloom-vault repository: [repository testing](../../../../intloom-vault/current/development/testing.md) and [Intent testing](../../../../intloom-vault/current/intent/testing.md).
