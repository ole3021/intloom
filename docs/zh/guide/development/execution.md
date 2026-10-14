---
title: 实现 Code 与 Agent
---

# 实现 Code 与 Agent

## Code

在引用源文件中默认导出 `ExecutableCode`。业务输入位于 Stage State；Runtime 当前以 `null` 作为调用输入执行 Step。

```ts
import type { ExecutableCode } from "@intloom/workflow-sdk";

const complete: ExecutableCode = (_input, access) => {
  access.signal.throwIfAborted();
  return { outcome: "complete" };
};

export default complete;
```

使用 `access.state`、`storage`、`interaction` 和可选 `project` 完成业务操作。能力调用需要 await，最后只返回路由 outcome。

## Agent

创建 `agents/reviewer.md`：

```md
---
name: reviewer
description: Review the current draft against the declared criteria.
---

Read the draft using the declared Tools.
Identify missing evidence and return the required structured outcome.
```

通过 Agent Step 片段绑定：

```yaml
review:
  type: agent
  agent: "@agents/reviewer"
  llm: review
  outputSchema: "@schemas/review-result"
  tools: []
  skills: []
  on:
    complete:
      end: true
```

创建 `schemas/review-result.ts` 并默认导出 Zod Schema，例如 `z.strictObject({ outcome: z.literal("complete") })`。将资源文件加入生产 TypeScript include。Agent 需要业务上下文时声明 Tools。

宿主在运行时构建或转交 Agent；Compiler 打包规范，不创建模型。最终输出必须满足公开 Schema 的输入形状，由原始解析器验证一次。

参见 [Tools/Skills](./tools-skills.md)、[人工交互](./interaction.md)和 [SDK 参考](../reference/sdk.md)。
