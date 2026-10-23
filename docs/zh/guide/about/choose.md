---
title: 选择 CMD、TUI 或 MCP
---

# 选择 CMD、TUI 或 MCP

根据你希望如何操作，以及希望 Agent 在哪里推理，选择入口。

| 方式 | 交互方式 | Agent 执行环境 |
| --- | --- | --- |
| CMD | 命令、文件、JSON 和脚本 | 项目 Service |
| TUI | 常驻终端界面与表单 | 项目 Service |
| 外部 MCP，`useMcpAgent: true` | 已连接的 Agent 客户端 | 外部客户端 |
| 外部 MCP，`useMcpAgent: false` | 已连接的 Agent 客户端 | 项目 Service |

CMD 和 TUI 的服务执行需要 `llms.default` 及其启动凭据。默认外部 MCP 策略使用客户端的 Agent 环境，无需项目模型配置。Service 可以在执行环境尚未就绪时启动。

## 建议的阅读路线

先完成[安装](../start/installation.md)和[项目初始化](../start/project.md)，再选择 [CMD](../start/cmd.md)、[TUI](../start/tui.md) 或 [MCP](../start/mcp.md)。IntLoom 当前提供的专用客户端适配器是 [Codex](../usage/clients/codex.md)。

这些入口共享执行状态和正式数据。关闭客户端只结束观察；控制执行需要明确取消或停止。Run 创建时会固定执行环境。

定义自己的流程请阅读 [Workflow 开发](../development/create.md)。集成可信 Node.js 客户端请阅读 [ProjectClient](../reference/project-client.md)。
