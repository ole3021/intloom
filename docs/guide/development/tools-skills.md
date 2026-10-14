---
title: Author Tools and Skills
---

# Author Tools and Skills

## Typed Tools

Create a named export in `tools/draft.ts`:

```ts
import { defineAgentTool } from "@intloom/workflow-sdk";
import * as z from "zod";

export const readDraft = defineAgentTool({
  id: "read_draft",
  description: "Read the current Stage draft.",
  inputSchema: z.strictObject({}),
  outputSchema: z.json(),
  execute: (_input, access) => z.json().parse(access.state.value ?? null),
});
```

Reference it from Step YAML as `@tools/draft:readDraft` and include `tools/**/*.ts` in the build configuration.

Host input parsing occurs before `execute`; output parsing occurs after it. Tools receive State, read-only Storage, cancellation and optional Project access. They have no formal commit or human-interaction capability. Await writes and other asynchronous work before returning.

Project commands that cannot start return nonzero results: 126 for unavailable requested cwd, 127 for ENOENT before a child starts with an intact project root. The Agent can correct command/args/cwd in-call; no process was replayed. Permission, path-boundary, project-root loss and cancellation failures still throw.

For transforms, `execute` returns the output parser's input; `AgentTool<Input, Output, RawOutput>` describes that distinction. Advertise concrete transformed result shapes with an explicit output Schema.

For a final draft submission, optionally define `endsAgent: (output) => output.saved`. The host evaluates it after validating the Tool's parsed JSON result. A `true` closes further Tools for that invocation; a `false` leaves a rejected draft correctable. The Agent still returns a valid final outcome, and Workflow Code still owns Check, confirmation and commit. Client receipt readback remains available after closure. Keep the predicate synchronous and free of side effects.

## Skills and assets

Create `skills/review/SKILL.md`:

```md
---
name: review
description: Check a draft for unsupported claims.
---

Read the draft and connect each conclusion to evidence.
Use references/criteria.md when applying the review criteria.
```

Add the actual `references/criteria.md` attachment and bind `@skills/review` in the Agent Step. Compiler packages referenced Skill assets; external clients read declared asset IDs, not arbitrary host paths.

A Skill describes a method; Tools provide callable operations. Neither creates an additional execution engine. See [YAML resources](../reference/workflow-yaml.md).
