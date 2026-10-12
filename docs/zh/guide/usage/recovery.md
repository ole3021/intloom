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

正常关闭会保留已提交数据、连接身份和未完成的检查点。普通崩溃恢复在继续受支持的执行边界前验证精确 Workflow 身份和 Stage Schema。镜像派生的暂停分支使用下面的镜像规则。

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

## 本地运行镜像

镜像默认关闭。显式开启后，每个真实安全边界保存独立的完整副本：Run/Stage 检查点、整个项目的正式 Artifact/Record，以及声明业务范围中的文件字节。

```yaml
mirror:
  enabled: true
  files:
    include: ["dist/**"]
    exclude: ["scratch/**"]
```

默认业务文件范围排除 `dist/`；`include` 可将其加入。系统保护始终排除配置、凭据文件、`.git/`、`.intloom/`、依赖、正式 Storage 和实际加载的 Workflow 代码。`inspect` 展示完整文件清单、排除项、State 原始输入/解析值、已验证路由、正式数据、来源、观测基线与前一个镜像的简单差异摘要。镜像位于 `.intloom/mirrors/runs/<traceId>/`，不自动删除或上传。

```sh
intloom mirror list --project ./source --json
intloom mirror inspect <mirrorId> --project ./source --json
intloom mirror restore <step-before-id> --project ./source --to ../case-step --scope step
intloom start --project ../case-step
intloom run resume <runId> --project ../case-step
intloom run resume <runId> --project ../case-step --scope workflow
intloom mirror export <traceId> --project ./source --to ../mirror-data
```

目标目录须事先准备当前配置和 Workflow，服务停止且业务文件、正式 Storage、执行检查点为空。恢复不安装 Workflow、不覆盖文件、不切换后端、不接受 `force`。`--dry-run` 校验并输出写入位置。每次恢复保留业务 runId 与正式 ID/revision/时间，但生成新的 traceId；源镜像保持只读，目标文件使用独立副本。

恢复完成和随后启动服务都保持 `paused/restored`，直到显式 `run resume`。首次继续沿用恢复时的 scope；范围结束后必须显式选择新 scope。默认 `wait` 会返回暂停，`--until terminal` 可继续观察最终结束。

| scope | 起点与结束 |
| --- | --- |
| `step` | 只接受真实 `step_before`；调用一次，保存 `step_after` 后暂停，不应用后续路由 |
| `stage` | 从 Workflow 入口、初始化前/后或访问中的 Step 边界，完成该次 Stage 访问后暂停，不初始化下一 Stage |
| `workflow` | 从非终态安全边界继续剩余 Workflow |

`stage_before_init` 使用当前初始化器重测。`stage_start`/`step_before` 装载保存 State，不重复初始化；clear 后的空绑定也不会重初始化。`step_after` 应用保存 outcome，不重调已完成 Step，因此拒绝 `step_after + step scope`。`stage_end` 从已保存目标继续，旧 State 仅为退出历史，拒绝 stage scope。终态只可查看/导出。真实 Workflow 终态不会因 scope 被改写为暂停。

修改 Code 后可以尝试镜像恢复，身份变化只产生警告；当前 Stage/Step、路由、执行政策和 Stage Schema 仍须兼容。Schema 重新解析保存的原始 input，结果必须与保存 value 结构相等。恢复失败返回 `MIRROR_RESTORE_FAILED` 与具体原因，不迁移、修补或自动重跑；请手动从头执行 Workflow 生成新镜像。恢复后实际执行失败保留其执行错误分类。

捕获失败暂停在原安全边界并显示 `mirror_capture_failed`；显式 resume 重试捕获，已返回的 Step 不会重复调用。目标有 `.intloom/restore.lock` 表示提交未完成：保持服务停止，检查该文件记录的临时区、计划与本次创建路径；只清理本次新建内容后再解除标记。启动不会自动运行半成品。

精确重试 resume 请求需保留原 `--instance`、`--operation-id`、`--revision` 与 scope 参数。相同请求返回原回执；服务实例或 revision 变化返回冲突。

镜像只覆盖受控本地写入。捕获窗口中不要用编辑器或其他进程改写业务文件；检测到变化会拒绝发布。当前安全上限为单文件 64 MiB、单镜像文件字节 1 GiB、10,000 个条目，触及上限明确失败。镜像不复制外部数据库/服务，不撤销消息或其他外部副作用；重做 Step 可能重复这些效果。业务 State/正式数据不自动匿名化，导出前检查实际内容。

持续的捕获失败也可显式使用 `run resume <runId> --scope workflow --abandon-mirror` 放弃本 Run 后续镜像捕获；检查点保留 captureDisabled 和原因，不伪称遗漏的镜像已完成。step/stage scope 不接受此放弃方式。
