---
title: 了解 IntLoom
description: 了解框架、公开包，以及从意图到留存结果的执行过程。
---

# 了解 IntLoom

IntLoom 是一个本地工作流框架，用于协调 Agent、代码和人的决策。项目服务加载已安装的 Workflow 包，执行其中的步骤，处理问题与确认，并保存 Workflow 明确提交的结果。

当任务需要明确的流程，例如推理、确定性检查、人工审核和结果留存时，可以使用 IntLoom。Workflow 定义流程，框架负责执行；框架不要求每个包都包含固定的业务阶段。

## 主要对象

- **项目（Project）**：保存配置、已安装 Workflow 的声明、源文件和结果。
- **工作流（Workflow）**：描述可执行的阶段和步骤。安装包后，其中注册的工作流可供服务加载。
- **运行（Run）**：针对一个原始意图执行一次 Workflow。回答问题和补充反馈会继续同一个 Run。
- **产物与记录（Artifacts、Records）**：Workflow Code 保存的正式结果，其业务含义由创建它们的包定义。

执行和数据边界见[核心概念](./workflow.md)。

## 选择使用方式

| 目标 | 从这里开始 |
| --- | --- |
| 使用已连接 IDE 的推理环境 | [通过 MCP 运行](./quickstart/mcp.md) |
| 在终端中使用项目配置的模型 | [通过 CLI 运行](./quickstart/cli.md) |
| 定义自己的流程 | [创建 Workflow](./development/create.md) |
| 构建可信的 Node.js 客户端 | [ProjectClient 参考](./reference/project-client.md) |

两种执行方式使用同一个本地服务和业务 Tools。执行器在 Run 创建时固定；修改项目配置不会把已有 Run 切换到另一种模型环境。

## 公开包的职责

| 包 | 用途 |
| --- | --- |
| `intloom` | 轻量命令入口，依赖版本匹配的 CLI |
| `@intloom/cli` | CLI、项目服务、MCP 端点及 Node.js ProjectClient |
| `@intloom/workflow-sdk` | 公开的 Workflow 契约和 Agent Tool 辅助函数 |
| `@intloom/compiler` | 构建阶段使用的 Workflow 编译器 |
| `@intloom/utils` | 共享日志、错误和标识符工具 |

`@intloom/kernel` 是私有包，随 CLI 一起提供。Workflow 作者在运行时依赖 SDK，在开发时使用 Compiler，无需安装公开的 Kernel 包。Workflow 包与 CLI 分开安装。

## 文档范围

这些文档介绍框架的配置、操作、扩展和接口参考，不包含特定业务包的手册或完整应用示例集。支持某个接口，并不能证明某个模型、客户端或部署环境已经通过验证；请先查看[当前能力](./status.md)。

接下来阅读[开始使用](./getting-started.md)。

