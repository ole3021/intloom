---
title: 通过 MCP 完成第一次运行
---

# 通过 MCP 完成第一次运行

安装 IntLoom、初始化项目并安装 Intent Workflow。生成配置中的 `useMcpAgent: true` 让已连接的 Agent 客户端负责推理，无需配置项目 `llms`。

## 连接 Codex

```sh
intloom mcp init --ide codex --plan --json
intloom mcp init --ide codex
intloom start
intloom doctor --execution agent_ide
```

项目 `.codex/config.toml` 使用安装后的绝对路径启动 stdio 代理，代理发现并连接已有 Service。在 Codex 打开同一个可信项目，刷新或重连 MCP 服务。参见 [Codex 设置](../usage/clients/codex.md)。

## 请求客户端运行 Workflow

```text
Use IntLoom's intent Workflow to build a Todo app with local persistence.
Keep the same Run ID, execute each pending Agent task with its declared tools,
and ask me the Workflow's questions and confirmations before continuing.
At the end, show the Validation report and its evidence.
```

客户端只调用一次 `flow`，随后检查返回的 Run、执行待处理 Agent 任务并呈现人工操作。工具连接成功本身不能证明客户端实现了完整协议。

保持问题与确认内容对用户可见。客户端推理不能编造用户答案或人工批准。

## 从终端检查

```sh
intloom runs --flow intent
intloom artifacts --flow intent
intloom artifact --flow intent --stage validation
```

客户端断开后，先查看原 Run，再决定如何继续。参见 [MCP 操作指南](../usage/mcp.md)和 [Agent 任务协议](../reference/mcp.md)。
