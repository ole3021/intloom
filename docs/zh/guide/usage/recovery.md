---
title: 重启与恢复执行
---

# 重启与恢复执行

停止 Service 会挂起执行，在 `.intloom/runtime/` 保留检查点。启动时先校验全部恢复数据，再启动兼容的未完成 Run。

| 已保存边界 | 重启行为 |
| --- | --- |
| 已完成 Step 的结果 | 推进已校验路由，不重复执行该 Step |
| 实现 `ExecutableCode.recover` 的人类等待 | 保留 action 身份，接受回答后通过新 Call 进入恢复入口 |
| 已接受但尚未交付的回答 | 使用显式恢复入口，不重复 Code 中等待之前的逻辑 |
| 没有恢复支持的人类等待 | 报告 `RUN_INTERRUPTED` |
| 执行中的 Code、模型或外部 Agent 等待 | 报告执行结果不确定，不重放外部副作用 |
| 终态 Run | 加载只读历史视图，保留正式数据和已知提交引用 |

恢复会还原 Stage State 并创建新能力，不能还原 JavaScript 局部变量、Promise、旧 Access 对象、Agent claim 或旧实例统计。回答先持久化，再交付；继续执行前先保存执行标记。Loom 作者应在支持的人类交互边界提供 `ExecutableCode.recover`。

保留原操作 ID 和 Service 实例 ID。回执查询明确区分已找到、当前实例不存在和实例已变化。重启后可用 `runs --operation-id UUID --origin-instance OLD` 查找原操作创建的 Run，不向新实例重放旧操作。

检查点格式 3 不兼容旧格式。损坏或不兼容的检查点可能阻止启动，文件会保留以便检查；不自动迁移或推测重放。`recover --dry-run` 和 `recover` 处理过期进程资源，不修复业务 State 或重试结果未知的副作用。

删除 `.intloom/` 或正式 `intloom/` 数据可能丢失身份、恢复点或已提交结果，日志无法重建它们。显式历史实验使用[执行镜像](./mirrors.md)，恢复分支在执行 `resume` 前保持暂停。
