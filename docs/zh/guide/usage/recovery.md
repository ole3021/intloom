---
title: 停止、重启与恢复
description: 区分过期资源清理、受支持的 Run 恢复，以及结果不确定的操作。
---

# 停止、重启与恢复

恢复包含两项不同职责：崩溃后释放过期服务资源，以及在新服务中恢复受支持的 Run 检查点。`recover` 执行前者，`start` 处理后者。

## 正常重启

```sh
intloom stop
intloom start
intloom runs
intloom attach <runId>
```

正常关闭会保留已提交数据、连接身份和未完成的检查点。新服务在恢复受支持的执行边界前，会验证 Workflow 身份和 Stage Schema。

| 中断位置 | 重启后的行为 |
| --- | --- |
| 安全的 Stage/Step 边界 | 从保存的边界继续 |
| 已完成且结果已保存的 Step | 推进路由，不重复执行该 Step |
| 带有 `ExecutableCode.recover` 的 Code 问题或确认 | 恢复等待，或继续处理已保存的接受答案 |
| 没有 `recover` 的 Code 等待 | 以 `RUN_INTERRUPTED` 失败 |
| 结果不确定的在途操作 | 以 `RUN_INTERRUPTED` 失败，不自动重放 |
| 客户端 Agent 任务 | 以 `RUN_INTERRUPTED` 失败，不恢复领取所有权和 Tool 回执 |
| 已终止的 Run | 保留检查点用于诊断，但不重新加载到 `runs` |

正常进程内回答会继续原来的 Promise。跨进程恢复使用独立的 Code 入口和已保存的业务 State，两者是不同机制。

## 崩溃后

```sh
intloom doctor
intloom recover --dry-run
intloom recover
intloom start
```

清理要求确认所有者已退出，并且连接元数据有效。活跃或未知 PID、端口占用、无效元数据和不安全的锁会阻止清理。启动不会自动删除过期锁或结束元数据中保存的 PID。

`recover` 不会重放 Steps、修复业务数据、撤销文件修改或验证正式 Storage。请结合 Run 诊断和已提交数据决定下一步。

## 保留原始资源

检查点位于 `.intloom/runtime/`。恢复会验证包与协议版本以及资源内容。在 Run 完成前保留精确的已安装 Workflow；重新编译或替换可能导致无法恢复。

损坏或不兼容的检查点会被报告并保留。未完成的文件不会自动删除。删除这些文件后再终止服务，会放弃相关执行；日志和 Artifacts 不能重建缺失的 Run State。

`cancel` 明确结束 Run，不安排后续恢复。当前没有公开的失败 Run 重试命令。操作结果不确定时，先检查正式数据和项目实际文件，再开始新的 Run。

如果保存检查点以 `RUN_CHECKPOINT_FAILED` 失败，执行会停止。更早已经成功的业务提交不会因检查点错误而回滚。

Workflow 作者在承诺等待可恢复之前，应阅读[可重启的交互](../development/interaction.md)。

