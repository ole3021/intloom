---
title: Implement Code and Agents
---

# Implement Code and Agents

## Code

Default-export an `ExecutableCode` from a referenced source file. Business input lives in Stage State; Code receives only `access`; the Stage initializer receives the declared Loom inputs.

```ts
import type { ExecutableCode } from "@intloom/loom-sdk";

const complete: ExecutableCode = (access) => {
  access.signal.throwIfAborted();
  return { outcome: "complete" };
};

export default complete;
```

Use `access.state`, `storage`, `interaction` and optional `project` for business work. Await capability operations and return only the routing outcome.

## Agent

Create `agents/reviewer.md`:

```md
---
name: reviewer
description: Review the current draft against the declared criteria.
---

Read the draft using the declared Tools.
Identify missing evidence and return the required structured outcome.
```

Bind it in an Agent Step fragment:

```yaml
review:
  type: agent
  agent: "./agents/reviewer.md"
  llm: thinking
  outputSchema: "./schema/review-result.ts"
  tools: []
  skills: []
  on:
    complete:
      end: true
```

Create `schema/review-result.ts` with a default Zod Schema, such as `z.strictObject({ outcome: z.literal("complete") })`. Compiler checks the entry dependency graph. Declare Tools when the Agent needs business context.

The host constructs or hands off the Agent at runtime. Compiler packages its specification without creating a model. Final outputs must satisfy the advertised Schema input shape; the original parser validates them once.

See [Tools/Skills](./tools-skills.md), [interaction](./interaction.md), and [SDK reference](../reference/sdk.md).
