---
title: 连接 Codex
---

# 连接 Codex

Codex 是 IntLoom 当前支持的具名 MCP 适配器，提供项目配置生成和 Codex 交互呈现。Workflow 行为仍由 Service 管理。

## 生成项目配置

在已初始化的 IntLoom 项目中执行：

```sh
intloom mcp init --ide codex --plan --json
intloom mcp init --ide codex
intloom start
```

计划目标是 `.codex/config.toml`，报告 create/update/unchanged/conflict。应用时检查文件指纹，允许更新受管理的 IntLoom 条目；未受管理的冲突条目需要手工处理。

生成条目使用 Node 和 CLI 绝对路径、精确项目根目录、`--ide codex`、20 秒启动超时和 300 秒 Tool 超时，不包含动态 Service 端口或私有连接 token。

## 连接与验证

在 Codex 打开同一项目。项目级 MCP 配置要求项目可信；Codex CLI 可通过 `codex mcp list` 查看配置服务，通过 `/mcp` 查看活跃连接。这些客户端要求见 [Codex 官方 MCP 文档](https://developers.openai.com/codex/mcp/)。

通过连接后的客户端核验 `list_looms`，再完成 [MCP 快速开始](../../start/mcp.md)，包含 Agent 任务、真实人工回答和保存结果。

连接失败时检查 Service 状态、生成的可执行路径、项目可信状态和客户端 MCP 诊断。重新安装或改变 Node 路径后，重新生成配置并重连。配置生成成功本身不能证明客户端接受。
