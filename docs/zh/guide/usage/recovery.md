---
title: 重启与恢复执行
---

# 重启与恢复执行

正常停止 Service 会挂起执行，并在 `.intloom/runtime/` 保留检查点。启动时在受支持边界恢复兼容的未完成 Run。

## 哪些执行可以继续

| 边界 | 行为 |
| --- | --- |
| 已保存的 Step 结果 | 推进路由，不重复该 Step |
| 实现 `ExecutableCode.recover` 的 Code 等待 | 将保存的操作和回答交给恢复入口 |
| 没有恢复支持的 Code 等待 | 进入 `RUN_INTERRUPTED` |
| 不确定的进行中副作用或外部 Agent 调用 | 无法重建原调用 |
| 终态 Run | 保留正式数据，终态检查点不加载为实时历史 |

恢复重新提供 Stage 业务 State 和新能力，无法重建 JavaScript 局部变量、Promise、Agent claim 或旧实例统计。Intent 的 Specification 问题和确认等待支持恢复；Solution 等待当前要求 Service 保持存活。

## 操作顺序

停止前查看已有执行，保留精确兼容的 Workflow 资源，重启后查询恢复的 Run。损坏或不兼容的检查点可能阻止启动，文件不会因此被删除。

`recover --dry-run` 和 `recover` 处理过期进程资源，不修复业务 State，也不重试结果未知的副作用。

保留 `.intloom/` 和正式 `intloom/` 数据。删除可能丢失连接身份、未完成恢复或已提交结果；日志不提供重建能力。

主动恢复实验环境请使用[本地执行镜像](./mirrors.md)，恢复的 Run 会保持暂停，直到明确 `run resume`。
