---
title: 安装第一个 Workflow
---

# 安装第一个 Workflow

CLI 和业务 Workflow 包分别安装。在已初始化项目中，增加或移除包之前先停止 Service。

```sh
intloom stop
intloom loom add @intloom/intent
intloom loom list
```

只给出包名时，安装器解析注册表当前版本，并保存包名、精确版本、归档哈希及适用的本地来源。安装会禁用包脚本。

如果已有兼容的本地归档，可以替代注册表安装：

```sh
intloom loom add /absolute/path/intloom-intent-0.1.0.tgz
```

保留该归档，以便恢复安装。Workflow 产物协议必须与宿主兼容；协议版本和 npm 包版本分别管理。

## 检查加载

```sh
intloom start
intloom looms
```

`loom list` 显示已安装包，`looms` 显示当前 Service 加载的 Workflow、可用性与诊断信息。包安装成功后仍可能加载失败，应查看失败阶段和错误。

CMD/TUI 在执行 Run 前需要配置模型；外部 MCP 需要准备已连接的 Agent 客户端。继续阅读 [CMD](./cmd.md)、[TUI](./tui.md) 或 [MCP](./mcp.md)。
