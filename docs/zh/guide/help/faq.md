---
title: 常见问题
---

# 常见问题

## IntLoom 只能运行四阶段 Intent 流程吗？

不是。IntLoom 执行自定义 Workflow，四阶段属于 `@intloom/intent`。参见 [Workflow 概念](../concepts/workflow.md)。

## 安装 CLI 就会安装 Intent 吗？

不会。通过 `loom add` 单独安装业务包。

## 为什么 Service 可以启动，CMD 执行却提示模型问题？

启动加载项目资源。CMD/TUI 服务接收要求 `llms.default` 和启动凭据，即使 Workflow 只有 Code。外部 MCP 配合 useMcpAgent true 使用客户端环境。

## 关闭 TUI 或 MCP 会取消执行吗？

不会。明确 `cancel` 控制一个 Run，`stop` 控制 Service。

## 为什么 wait 在完成前返回？

默认等待到人工操作或终态。回答当前操作后再等待，`--until terminal` 不会替用户回答问题。

## completed 表示应用通过全部检查吗？

不是。Intent 完成表示 Validation 报告已保存，需要阅读各目标证据和发现。

## 结果在哪里？

正式数据位于 `intloom/`，通过 Service 查询 Artifacts/Records。[结果](../usage/results.md)解释 ID 与导出。

## 为什么重启后旧 Run 不在列表中？

列表属于实例。正式数据持久保存，受支持的未完成检查点可以恢复；不提供跨重启的完整终态历史。

## 失败后可以继续任意 Step 吗？

正常恢复支持特定边界和 Code 显式恢复入口。[镜像](../usage/mirrors.md)可在兼容的独立目标中暂停重放，并明确选择范围。

## 可以切换存储后端吗？

数据产生前选择 File 或 SQLite，不提供已有数据后端的自动迁移。

## 可以使用 Codex 之外的客户端吗？

兼容客户端可以实现通用 MCP 协议。当前只有 Codex 具名适配器，不代表其他产品已经验证。

## 开发 Workflow 需要安装 Kernel 吗？

不需要。运行时使用 SDK，构建时使用 Compiler。Kernel 私有，随 CLI 打包。
