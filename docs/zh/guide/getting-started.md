---
title: 开始使用
description: 配置项目并选择 CLI 或 MCP 执行方式。
---

# 开始使用

IntLoom 通过本地项目服务运行。在请求服务执行 Workflow 之前，先安装 CLI、初始化空项目，再安装兼容的 Workflow 包。

## 选择执行方式

| 方式 | Agent 在哪里推理 | 模型配置 |
| --- | --- | --- |
| [MCP](./quickstart/mcp.md) | 已连接的 IDE 或支持该协议的 MCP 客户端 | 默认 `useMcpAgent: true` 时，不需要项目 `llms` 配置 |
| [CLI](./quickstart/cli.md) | 项目服务中 | 执行前配置 `llms.default` 并提供凭据 |

从[安装与项目配置](./quickstart/installation.md)开始，其中介绍源码构建和已发布版本的安装方式。CLI 不内置业务 Workflow。

## 首次运行的顺序

1. 安装或构建 CLI。
2. 初始化一个新建或空的项目目录。
3. 安装需要执行的 Workflow 包。
4. 选择 MCP 或 CLI，并准备对应入口的执行环境。
5. 启动服务，检查 `flows`，然后创建一个 Run。
6. 使用同一个 Run 回答问题并完成确认。
7. 检查 Workflow 实际提交的结果。

`start` 启动服务，`flow` 创建 Workflow Run。服务成功启动，并不代表已经安装 Workflow，也不代表所选入口的模型配置已经就绪。

## 首次运行之后

- [Run 管理](./usage/runs.md)：继续、查看和取消执行。
- [结果](./usage/results.md)：查询和导出已提交的数据。
- [诊断](./usage/diagnostics.md)：排查加载或执行失败。
- [创建 Workflow](./development/create.md)：定义自己的流程。

