---
title: Code, Agents, Tools, and Skills
description: Implement execution resources with host-bound capabilities and explicit output contracts.
---

# Code, Agents, Tools, and Skills

Code and Agent Steps share outcome routing. They have different permissions and execution responsibilities.

| Capability | Code | Agent Tool |
| --- | --- | --- |
| Read and update current Stage State | Yes | Yes |
| Read formal Storage | Yes | Yes |
| Commit formal data | Yes | No |
| Ask questions or request confirmation | Yes | No |
| Use optional host-bound project operations | Yes | Yes |
| Observe cancellation | Yes | Yes |

## Code

Implement `ExecutableCode` from the SDK. Its inputs are the current execution input and bound access; the Runtime currently supplies `null` input and business data is read from `access.state`.

```ts
import type { ExecutableCode } from "@intloom/workflow-sdk";

const finish: ExecutableCode = (_input, access) => {
  access.signal.throwIfAborted();
  return { outcome: "complete" };
};

export default finish;
```

Await all capability operations. Do not retain `access`, start detached business tasks, or continue writes after the call returns. Cancellation invalidates ownership even if an external request finishes later.

## Agent instructions

An Agent reference resolves to Markdown with YAML frontmatter:

```md
---
name: reviewer
description: Review the draft against its recorded criteria.
---
Read the draft with the assigned Tool. Assess the recorded criteria.
Return only the outcome object required by the output Schema.
Do not answer questions or confirm on behalf of the user.
```

Step YAML supplies the role, Tools, Skills, and output Schema. An output module could export:

```ts
import * as z from "zod";

export default z.strictObject({
  outcome: z.enum(["accepted", "revise"]),
});
```

Instructions do not replace validation. Code should validate proposals, references, and preconditions before committing or performing consequential actions.

## Business Tools

Tools use the framework-independent SDK contract:

```ts
import { defineAgentTool } from "@intloom/workflow-sdk";
import * as z from "zod";

export const readDraft = defineAgentTool({
  id: "read_draft",
  description: "Read the current Stage draft.",
  inputSchema: z.strictObject({}),
  outputSchema: z.json(),
  execute: (_input, access) => access.state.value ?? null,
});
```

Reference that export as `@tools/review:readDraft` when stored in `tools/review.ts`. Both service and client execution call the original Tool in the host. Input and output use the original Zod parsers; MCP transports JSON Schema and JSON values, not executable parsers.

`execute` receives parsed input and must return raw input for the output parser. If the output Schema transforms a string into a number, return the string and let the host perform the transformation. See the [SDK reference](../reference/sdk.md#agenttool) for the three Tool type parameters.

Choose explicit proposal input fields instead of accepting an entire replacement State from the model. Keep confirmations, actual human answers, and authoritative check results owned by Code.

## Skills and attachments

A Skill lives at `skills/<name>/SKILL.md` and uses `name` and `description` frontmatter followed by instructions. It supplies reusable instructions and packaged supporting assets; it is not an independently scheduled Step.

The Compiler collects files under the referenced Skill directory, rejects symbolic links and private environment files, and preserves resource-relative asset paths. Installed client tasks expose declared attachments through asset IDs. Never embed credentials or rely on absolute paths into the authoring checkout.

## Project operations

`access.project` is optional. Check for it before using snapshots, text reads/writes/removal, or commands. Commands use an executable and argument array; shell syntax is not interpreted implicitly. Command results include exit code, timeout, and truncation, all of which matter when deciding whether a check passed.

Project access is a trusted local capability, not an OS sandbox. Its lifetime is bound to the execution, but cancellation cannot undo completed file edits. See [SDK reference](../reference/sdk.md) for limits and signatures.
