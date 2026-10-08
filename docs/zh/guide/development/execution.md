---
title: Code、Agents、Tools 与 Skills
description: 使用绑定到服务的能力和明确的输出契约实现执行资源。
---

# Code、Agents、Tools 与 Skills

Code 和 Agent Steps 共用 outcome 路由，但拥有不同的权限和执行职责。

| 能力 | Code | Agent Tool |
| --- | --- | --- |
| 读取和更新当前 Stage State | 可以 | 可以 |
| 读取正式 Storage | 可以 | 可以 |
| 提交正式数据 | 可以 | 不可以 |
| 提问或请求确认 | 可以 | 不可以 |
| 使用可选的服务绑定项目操作 | 可以 | 可以 |
| 感知取消 | 可以 | 可以 |

## Code

实现 SDK 中的 `ExecutableCode`。它接收当前执行输入和绑定的访问能力；Runtime 当前提供 `null` 输入，业务数据从 `access.state` 读取。

```ts
import type { ExecutableCode } from "@intloom/workflow-sdk";

const finish: ExecutableCode = (_input, access) => {
  access.signal.throwIfAborted();
  return { outcome: "complete" };
};

export default finish;
```

等待所有能力操作完成。不要保留 `access`、启动脱离执行的业务任务，或在调用返回后继续写入。即使外部请求稍后才完成，取消也会使执行所有权失效。

## Agent 指令

Agent 引用解析为带 YAML frontmatter 的 Markdown：

```md
---
name: reviewer
description: Review the draft against its recorded criteria.
---
Read the draft with the assigned Tool. Assess the recorded criteria.
Return only the outcome object required by the output Schema.
Do not answer questions or confirm on behalf of the user.
```

Step YAML 指定角色、Tools、Skills 和输出 Schema。输出模块可以导出：

```ts
import * as z from "zod";

export default z.strictObject({
  outcome: z.enum(["accepted", "revise"]),
});
```

指令不能替代验证。提交结果或执行有实质影响的操作前，Code 应验证提案、引用和前置条件。

## 业务 Tools

Tools 使用独立于框架实现的 SDK 契约：

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

保存在 `tools/review.ts` 时，通过 `@tools/review:readDraft` 引用该导出。服务和客户端执行方式都会在服务内调用原始 Tool。输入和输出使用原始 Zod 解析器；MCP 传输的是 JSON Schema 和 JSON 值，不是可执行解析器。

`execute` 接收解析后的输入，并应返回输出解析器的原始输入。输出 Schema 将字符串转换为数字时，应返回字符串，再由服务执行转换。三个 Tool 类型参数见 [SDK 参考](../reference/sdk.md#agenttool)。

使用明确的提案输入字段，不要接受模型对整个 State 的替换。确认、真实人工答案和权威检查结果应由 Code 管理。

## Skills 与附件

Skill 位于 `skills/<name>/SKILL.md`，使用包含 `name` 和 `description` 的 frontmatter，后面是指令。它提供可复用的指令和打包支持资源，不是独立调度的 Step。

Compiler 收集引用的 Skill 目录中的文件，拒绝符号链接和私有环境文件，保留资源相对路径。已安装的客户端任务通过资源 ID 暴露已声明附件。不要嵌入凭据，也不要依赖指向编写源码目录的绝对路径。

## 项目操作

`access.project` 是可选能力。使用快照、文本读取、写入、删除或命令前，先检查它是否存在。命令采用可执行程序和参数数组，不会隐式解释 shell 语法。命令结果包括退出码、是否超时和是否截断，判断检查通过时需要考虑这些字段。

项目访问是可信的本地能力，不是操作系统沙箱。它的生命周期绑定到执行，但取消不能撤销已完成的文件修改。限制和签名见 [SDK 参考](../reference/sdk.md)。
