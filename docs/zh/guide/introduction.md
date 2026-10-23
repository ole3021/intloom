---
title: 什么是 IntLoom？
---

# 什么是 IntLoom？

IntLoom 是一个本地 Workflow 框架，用于协调 Agent、可执行 Code 和人的决策。项目 Service 加载已安装的 Workflow 包，执行其中声明的阶段和步骤，呈现问题与确认，并保存 Workflow Code 提交的正式结果。

Workflow 定义流程，Run 针对一个意图执行一次流程。Code 执行确定性操作，Agent 使用声明的 Tools 和 Skills 推理，人通过明确的交互节点作出决策。你可以通过 CMD、TUI 或 MCP 查看执行过程和结果。

## 从你的目标开始

| 目标 | 下一步 |
| --- | --- |
| 第一次运行 IntLoom | [安装](./start/installation.md) |
| 从意图开始开发软件 | [Intent Workflow](./intent/overview.md) |
| 连接外部 Agent | [MCP 快速开始](./start/mcp.md) |
| 定义自己的流程 | [创建 Workflow](./development/create.md) |
| 理解执行与数据 | [架构](./concepts/architecture.md) |

## 框架与 Workflow 包

CLI 提供项目 Service 和使用入口，业务 Workflow 需要单独安装。`@intloom/intent` 提供 Specification → Solution → Implementation → Validation 四个阶段；这属于该包的业务流程，并非所有 IntLoom Workflow 的固定结构。

Workflow 作者在运行时使用 `@intloom/loom-sdk`，在构建时使用 `@intloom/compiler`。私有 Kernel 随 CLI 一起提供。

继续阅读[为什么需要 IntLoom](./about/why.md)，或[选择使用方式](./about/choose.md)。
