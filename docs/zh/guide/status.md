---
title: 当前能力
description: 已实现的框架行为、验证边界和兼容性要求。
---

# 当前能力

本文档描述当前开发版本。本地构建和包测试通过，不能证明某个版本已经在公共注册源中发布。源码使用方式和发布版本的前提见[安装](./quickstart/installation.md)。

## 已实现的框架行为

| 领域 | 可用行为 |
| --- | --- |
| 项目 | 初始化、本地服务生命周期、配置、包安装和诊断 |
| Workflow 执行 | ESM 加载、Stage 初始化、Code/Agent Steps、结果路由、人工交互和取消 |
| 执行方式 | 项目配置的服务模型，以及外部 MCP 客户端的 Agent 任务 |
| 正式 Storage | 文件和 SQLite 后端、原子操作批次、Artifact/Record 查询 |
| 恢复 | 检查点、安全的 Step 边界，以及显式 Code 交互恢复 |
| 编写 Workflow | YAML 定义、SDK 契约、Tools 和 Skills、编译后的 JS、声明及资源 |
| 客户端 | CLI、通用 MCP、Codex 配置及可信的 Node.js ProjectClient |

编译后的 Workflow 协议版本是 `2026-10-08`，与 npm 包版本不同。针对旧协议构建的包需要重新构建和安装。

## 需要考虑的边界

- 真实模型行为需要使用目标提供商、端点、模型和 Workflow 验证。配置就绪检查不会调用模型，也不能证明推理或 Tool 调用成功。
- 一次真实 Codex MCP 会话已完成四阶段的包工作流。这不能证明桌面原生表单的可用性、所有 MCP 客户端或每一种模型配置。另一次真实服务模型尝试因输出截断而失败。
- 活跃的客户端 Agent 任务及结果不确定的在途操作，不会在服务重启后继续。Code 等待需要显式的 `recover` 函数。见[恢复](./usage/recovery.md)。
- Studio 仍在规划中。面向未来界面的 Node.js 客户端契约已经可用，但还没有完成的 Studio 应用。
- 当前不提供热重载、自动包升级、自动存储后端迁移或失败 Run 的自动重放。
- 项目文件和命令能力使用服务进程的权限运行，不构成操作系统级沙箱。

## 运行时兼容性

包要求 Node.js 24 或更新版本。完整本地 CLI/MCP 验收以 Node.js 24 为基准。验证 Workflow 执行的命令时，应使用服务实际继承的 Node 版本。尤其不要把 Node 24 的 `--experimental-transform-types` 参数直接用于 Node 26，Node 26 会拒绝该参数。

比较部署环境与开发文档时，查看已安装 CLI 的 `--version` 和 `--help`。升级 CLI 后重启已有服务；运行中的进程仍使用已经加载的资源。

