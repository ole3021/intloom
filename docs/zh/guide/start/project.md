---
title: 初始化项目
---

# 初始化项目

通过 CMD 创建新项目或初始化空目录：

```sh
intloom init my-project
cd my-project
```

初始化生成项目配置，不覆盖已有文件。也可以一次安装 Workflow 并配置 Codex：

```sh
intloom init my-project --workflow @intloom/workflow-intent --mcp codex
```

选择其中一种初始化路径。`--workflow` 可以重复传入，`--start` 可在设置完成后启动 Service。输出分别报告目录创建、Workflow 安装、MCP 配置和 Service 启动的结果。重复操作前先检查部分成功的步骤。

## 项目目录

| 路径 | 用途 |
| --- | --- |
| `intloom.yaml` | 项目标记、Workflow 声明、模型和偏好 |
| `intloom/` | 正式 Artifacts/Records 或 SQLite 数据；可选 `host.json` |
| `.intloom/` | 安装内容、发现凭据、日志、运行检查点和可选镜像 |
| `.codex/config.toml` | 选择 Codex 后生成的 MCP 条目 |

命令通常向上查找最近的项目。`--project /absolute/path` 会选择精确的项目根目录。

保护连接凭据。移动或备份项目时保留正式数据和未完成的恢复文件。下一步：[安装 Workflow](./workflow.md)，再选择快速开始。
