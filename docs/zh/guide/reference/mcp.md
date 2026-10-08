---
title: MCP 参考
description: 服务端点、业务工具、Agent 任务所有权、人工操作和重试规则。
---

# MCP 参考

本地服务通过回环地址提供经过认证的 Streamable HTTP 端点。`/mcp` 是通用外部 Agent IDE 入口；`/mcp/codex` 增加 Codex 展示配置。两者使用相同的业务处理和 Agent 任务协议。

内部 `/internal/mcp` 和 `/internal/mcp/studio` 绑定 CLI 和 Studio 后端的来源策略。内部端点缺失时，不要回退到外部端点，因为来源决定执行策略。

使用生成的连接元数据和受支持的客户端辅助函数。Bearer 凭据和任务所有权令牌应保密。会话始终绑定到原始端点。

## Workflow 与结果工具

| Tool | 输入 | 结果字段 |
| --- | --- | --- |
| `flow` | `flowName`、`intent` | `run` |
| `list_workflows` | 空对象 | `workflows` |
| `get_run` | `runId` | `run` |
| `list_runs` | 可选 `flowName` | `runs` |
| `interact` | `runId`、`actionId` | 原生交互或当前、继续后的 Run |
| `answer_ask` | `runId`、`actionId`、`answer` | `run` |
| `cancel_run` | `runId` | `run` |
| `status` | 空对象 | `service` |
| `get_record` | `recordId` | `record` |
| `get_artifact` | `artifactId`，或同时提供 `flowName` 和 `stageName` | `artifact` |
| `list_artifacts` | 可选 `flowName`、`stageName`、`limit`、`cursor` | `artifacts` 分页 |

Artifact 列表包含元数据，详情包含业务数据。缺失的 Record/Artifact 详情返回 `null`。业务错误返回 `isError: true` 和分类错误载荷。客户端应处理结构化内容、JSON 文本内容，以及适用时的原生交互响应。

## Agent 任务工具

外部入口额外提供六个工具。任务引用为 `{ runId, callId }`，持有所有权的引用还包含 `ownerToken`。

| Tool | 额外输入 | 结果 |
| --- | --- | --- |
| `get_agent_call` | 任务引用 | `agentCall` |
| `claim_agent_call` | 任务引用及 `claimId` | `task`、`ownerToken` |
| `call_agent_tool` | 所有权引用及 `toolCallId`、`toolId`、`input` | `output` |
| `read_agent_asset` | 所有权引用及 `assetId` | 已声明资源内容及编码 |
| `complete_agent_call` | 所有权引用及 `result` | 继续后的 `run` |
| `fail_agent_call` | 所有权引用及 `message` | 失败的 `run` |

将当前 `pendingAgentCall.id` 用作 `callId`。生成并保留稳定且唯一的 `claimId`。其他领取者会发生冲突；使用同一身份重新连接可以恢复仍活跃的领取。返回任务包含指令、Skills、已声明 Tools 和最终输出 Schema。

Tools 串行执行。使用相同 `toolCallId` 和相同输入重试，会返回保留的回执；修改输入会发生冲突。每个任务最多保留 256 个回执。完成任务之前，必须结束在途 Tools。资源只接受已声明 ID，不接受任意路径，每次读取最多 1 MiB。

根据任务为输出解析器声明的输入结构，提交原始最终 JSON。服务解析后继续原来的 Step。跟随返回的 Run，不要调用 `flow` 来推进到下一个任务。

## 人工答案

对于 `user_ask_questions` 操作，`answer` 是完整答案数组：

```json
[
  { "questionId": "destination", "isSkipped": false, "answer": "Local project" },
  { "questionId": "notes", "isSkipped": true }
]
```

使用实际问题 ID，仅在允许时跳过。确认答案为：

```json
{ "isConfirmed": false, "feedback": "Please revise the proposed scope." }
```

`interact` 尝试协商后的原生交互。如果不可用，由客户端展示返回的操作，并通过 `answer_ask` 提交用户的准确答案。取消客户端表单会保留等待，不是取消 Run。Agent 执行不能授权人工确认。

## 重试与重启规则

创建 Run 不是幂等操作。结果不确定时先查询，不要重放 `flow`。领取任务和 Agent Tool 操作通过明确的身份支持进程存活期间的重试。完成操作的重试受当前调用保留结果的边界限制，不是跨后续任务或重启的持久重放。

取消使所有权失效并拒绝迟到结果。服务重启不会恢复活跃 Agent 任务、原来的 Promise 或回执；中断任务变为 `RUN_INTERRUPTED`。当前没有租约抢占、自动模型回退或由连接触发的客户端唤醒。

用户配置见 [MCP 快速开始](../quickstart/mcp.md)，进程边界见[恢复](../usage/recovery.md)。

