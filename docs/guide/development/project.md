---
title: Operate on project files and commands
---

# Operate on project files and commands

The host can bind optional `ProjectAccess` to a Code or Agent Tool call. Check availability before use.

```ts
import type { ExecutableCode } from "@intloom/loom-sdk";

const check: ExecutableCode = async (access) => {
  if (!access.project) throw new Error("Project access is required.");
  access.signal.throwIfAborted();
  const result = await access.project.run({
    command: "node",
    args: ["--version"],
    timeoutMs: 10000,
  }, access.signal);
  if (result.exitCode !== 0 || result.timedOut) {
    throw new Error("Project check failed.");
  }
  return { outcome: "complete" };
};

export default check;
```

The example executes a real argument-array command with cancellation. Results contain command, exitCode, stdout, stderr, timedOut and truncated. Treat output truncation or timeout according to your business verification rules.

## Other operations

`snapshot` returns a file/hash view; `read` reads text; `write` and `remove` modify project-relative paths. The host chooses root, exclusions, limits and lifetime. Await all operations.

Project access provides trusted local capabilities and does not establish an OS sandbox. It is separate from Storage transaction atomicity. Repeating a Step can repeat file/command side effects.

Declare only needed engineering Tools for each Agent. For example, Intent's design and validation roles have read Tools, while implementation can write and run commands.

See [SDK reference](../reference/sdk.md) and [local mirrors](../usage/mirrors.md).
