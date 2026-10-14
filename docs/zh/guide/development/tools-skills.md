---
title: 编写 Tools 与 Skills
---

# 编写 Tools 与 Skills

## 类型化 Tools

在 `tools/draft.ts` 创建命名导出：

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

Step YAML 使用 `@tools/draft:readDraft` 引用，并在构建配置加入 `tools/**/*.ts`。

宿主在 `execute` 前解析输入，在返回后解析输出。Tool 获得 State、只读 Storage、取消信号和可选 Project 能力，没有正式提交和人工交互能力。返回前 await 写入及其他异步工作。

项目命令在进程尚未启动时返回非零结果：指定 cwd 不可用返回 126，项目根目录有效且启动收到 ENOENT 返回 127。Agent 可在当前调用内修正 command/args/cwd，没有进程重放。权限、路径边界、项目根目录丢失及取消错误仍会抛出。

存在 transform 时，`execute` 返回输出解析器的输入；`AgentTool<Input, Output, RawOutput>` 表达这一区别。使用明确输出 Schema 描述转换后的具体结果形状。

最终草稿提交可以声明 `endsAgent: (output) => output.saved`。宿主在 Tool 的 JSON 输出校验后执行此谓词；true 关闭本次调用的后续 Tools，false 允许修正被拒绝的草稿。Agent 仍须返回合法最终 outcome，Check、确认和正式提交仍由 Workflow Code 负责。客户端已完成 receipt 的读取仍可重复。谓词必须同步且无副作用。

## Skills 与附件

创建 `skills/review/SKILL.md`：

```md
---
name: review
description: Check a draft for unsupported claims.
---

Read the draft and connect each conclusion to evidence.
Use references/criteria.md when applying the review criteria.
```

创建真实 `references/criteria.md` 附件，并在 Agent Step 绑定 `@skills/review`。Compiler 打包引用的 Skill 附件；外部客户端读取声明的 asset ID，不接受任意宿主路径。

Skill 描述方法，Tool 提供可调用操作；两者都不创建额外执行引擎。参见 [YAML 资源](../reference/workflow-yaml.md)。
