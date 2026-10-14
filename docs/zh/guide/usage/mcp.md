---
title: MCP 操作指南
---

# MCP 操作指南

MCP 将外部 Agent 客户端连接到项目 Service。`intloom mcp serve` 是连接已有进程的 stdio 代理，需要明确启动 Service。

默认外部策略 `useMcpAgent: true` 让客户端执行 Agent Step。设为 false 后使用项目 Service 模型。策略在 Run 创建时固定。

## 跟随返回的 Run

1. 调用 `list_workflows`，选择可用 `flowName`。
2. 使用完整意图只调用一次 `flow`。
3. 检查 `pendingAgentCall`，认领并执行声明的任务。
4. 检查 `pendingAction`，向用户呈现问题或确认，提交真实回答。
5. 跟随返回的 Run，直到终态，再查询已提交结果。

外部客户端需要实现 [MCP 参考](../reference/mcp.md)中的认领、Tool 和完成协议。仅把任意聊天 Agent 连接到服务，不能证明互操作成立。

## 原生交互与回退

`interact` 尝试协商的原生表单。不可用时，客户端呈现返回的操作，通过 `answer_ask` 提交。关闭表单保留等待状态，推理 Agent 不能代替人批准确认。

## 客户端专用设置

[Codex](./clients/codex.md) 提供生成配置和专用呈现方式。其他客户端实现通用协议后可以接入；当前版本没有其他具名适配器。

断开连接不取消 Run。保留 ID，重连后查看原执行。进行中的 Agent 所有权不跨 Service 重启保留。参见[恢复](./recovery.md)。
