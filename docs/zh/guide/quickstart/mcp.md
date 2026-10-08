---
title: 通过 MCP 运行
description: 将已连接客户端的推理环境与 IntLoom 本地项目服务配合使用。
---

# 通过 MCP 运行

先完成[项目配置](./installation.md)，并安装兼容的 Workflow。客户端必须能执行 IntLoom 的 Agent 任务协议，包括领取任务、调用业务 Tools 和提交结果。仅连接 MCP 端点不会自动完成任务。

## 启动项目服务

保留生成的 `workflows` 声明和默认的 `useMcpAgent: true`。此入口不需要项目 `llms` 配置。

```sh
intloom start
intloom doctor --execution agent_ide
intloom flows
```

`flows` 是 CLI 查询，其中报告的就绪状态针对 CLI 入口。MCP 执行方式应使用 `doctor --execution agent_ide`。是否可加载和入口是否就绪是不同的检查。

## 连接 Codex

```sh
intloom config codex
```

该命令输出为当前项目生成的配置。将其合并到目标项目的 `.codex/config.toml`；命令本身不会修改 IDE 配置。配置片段指向 `/mcp/codex`，使用认证辅助程序而非直接嵌入本地令牌。通过客户端的项目信任和权限设置启用连接。

通用 MCP 客户端使用经过认证的本地回环 `/mcp` 端点。客户端实现者可阅读 [MCP 参考](../reference/mcp.md)。连接元数据和任务所有权令牌应保密。

## 运行与继续

让客户端列出 Workflows，选择目标 `flowName`，并携带意图调用一次 `flow`。随后根据返回的 Run 快照继续：

| 快照 | 下一步 |
| --- | --- |
| `pendingAgentCall` | 领取并执行 Agent 任务，然后提交结果 |
| `pendingAction` | 展示问题或确认内容，并获取你的真实回答 |
| `completed` | 检查已提交的结果 |
| `failed` | 阅读错误，并检查先前产生的影响 |

客户端通过 `call_agent_tool` 调用已声明的业务 Tools，通过 `complete_agent_call` 提交最终结构化结果。人工交互使用 `interact`；如果没有原生表单，则先展示实际问题，再调用 `answer_ask`。客户端不能编造答案，也不能再次调用 `flow` 来继续等待中的 Run。

## 验证结果

```sh
intloom runs
intloom artifacts
```

阅读返回的 Run 以及相关 Artifacts 和 Records。无论 Run 由哪个入口创建，都可以在终端查询。`completed` 表示流程完成，业务结果是否满足目标需要单独评估。

客户端执行 Agent 任务期间，需要保持服务运行。客户端用原来的领取身份重新连接，可以继续仍存活的任务；重启服务会中断任务。详见[恢复](../usage/recovery.md)。

如果希望从 MCP 使用项目模型，请设置 `useMcpAgent: false`，完成[模型配置](../usage/configuration.md)并重启。不会自动回退到服务端模型。

