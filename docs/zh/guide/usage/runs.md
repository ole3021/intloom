---
title: 运行、回答与取消
description: 管理 Run 身份、人工等待、Agent 任务和终止结果。
---

# 运行、回答与取消

针对一个意图创建一个 Run，之后使用返回的身份继续它。重复调用 `flow` 会创建新的任务，不会恢复已有执行。

```sh
intloom flow your_flow --intent-file intent.txt
intloom runs
intloom runs --flow your_flow
intloom attach <runId>
```

将 `your_flow` 和 `<runId>` 替换为服务返回的值。意图文件设为 `-` 时，从 stdin 读取。

## 读取 Run

| 字段 | 含义 |
| --- | --- |
| `runId` | 执行身份 |
| `flowName` | 已注册的 Workflow 名称 |
| `status` | `running`、`waiting`、`completed` 或 `failed` |
| `cursor` | 当前 Stage 和 Step |
| `execution` | 固定的来源和 Agent 执行器 |
| `pendingAction` | 待处理的人工问题或确认（如有） |
| `pendingAgentCall` | 待处理的客户端 Agent 任务（如有） |
| `lastError` | 终止失败的错误码、消息和是否可重试 |

等待中的 Run 同一时刻只有一种待处理任务。客户端 Agent 等待不意味着可以提交人工答案；普通 CLI `attach` 也不能执行已连接 IDE 的推理任务。

## 回答与审核

交互式 CLI 的 `flow` 或 `attach` 会展示当前问题或确认。选项会解析为实际答案文本，只有 Workflow 允许时才能跳过。确认会先展示 Workflow 提供的上下文，再要求确认或提出修改。

取消尚未提交的表单会保留 Run 的等待状态。提出修改会提交业务答案，并沿包的反馈路由继续。关闭终端本身不会停止项目服务。

MCP 客户端使用 `interact`；没有原生表单时，展示真实问题并调用 `answer_ask`。Node.js 程序客户端使用 `answerAsk(runId, actionId, answer)`。始终使用当前操作 ID，并保留真实的人工回答。答案结构见 [MCP](../reference/mcp.md)。

## JSON 与非交互模式

```sh
intloom flow your_flow --intent "Describe the result" --json
intloom attach <runId> --json
intloom runs --json
```

非 TTY、`--json` 和 `--no-interactive` 模式不会提问。等待中的 `flow` 正常返回，因此需要检查状态，不能把退出码 0 当作完成。失败返回非零退出码。JSON 业务输出与 stderr 中的进度和日志分开。

请求超时或客户端断开后，原来的 Run 可能仍在执行。重试之前先查询它；请求不会自动重放。

## 取消一个 Run 或停止服务

```sh
intloom cancel <runId>
intloom stop
```

`cancel` 明确结束一个 Run，撤销当前执行权限并阻止后续恢复。取消表示为 `failed`，错误码为 `RUN_STOPPED`；终端界面显示 Stopped。重复取消已有终止 Run 会成功，且不改变快照。Run 不存在时返回错误。

`stop` 关闭项目服务，保留未完成的恢复检查点。它不保证每个中断的 Run 都能继续。详见[恢复](./recovery.md)。

两种操作都不会回滚已提交的 Storage 数据或已有文件修改。独立运行的 IDE 原生命令可能继续执行，不受服务控制。

## 并发与保留的 Run

独占 Workflow 会拒绝同一服务内竞争的活跃 Run，包括等待中的 Run。这不会锁住外部编辑器，也不会协调无关服务。已完成 Run 在当前服务中仍可查询；重启后，终止检查点文件不会重新加载为 Run。持久历史应以正式结果为准。

