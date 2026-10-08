---
title: 读取与导出结果
description: 查询当前 Artifacts、读取 Records，并保留正式项目数据。
---

# 读取与导出结果

Workflow Code 决定提交哪些结果。已完成的 Run 可以产生多个结果、没有结果，或生成仍有未解决问题的报告。应阅读包的数据和证据，不要把流程完成理解为所有业务检查都成功。

## 查找当前 Artifacts

服务运行时：

```sh
intloom artifacts
intloom artifacts --flow your_flow --limit 20
intloom artifact --flow your_flow --stage your_stage
intloom artifact <artifactId> --json
```

按 Artifact ID 查找不能与 Workflow/Stage 查找同时使用。按位置查找必须同时提供 `--flow` 和 `--stage`。缺失的详情查询返回 `artifact: null`，不会创建 Artifact。

列表返回元数据和可选的 `nextCursor`。使用游标时保持筛选条件和条数限制不变：

```sh
intloom artifacts --flow your_flow --limit 20 --cursor '<nextCursor>' --json
```

默认每页 50 条，最多 200 条。完整业务数据通过详情命令读取。

## 导出快照

```sh
intloom artifact <artifactId> --output ./result.json
```

目标路径相对于命令的工作目录，即使 `--project` 指向其他目录也一样。父目录必须存在。导出包含完整存储对象：ID、Workflow/Stage、revision、时间戳和业务数据。

除非显式使用 `--overwrite`，否则已有文件会被拒绝。导出不存在的 Artifact 会失败，且不会创建文件。服务不会接收导出路径，客户端将返回的快照写入本地。

## 读取 Record

```sh
intloom record <recordId>
```

Record ID 由 Workflow 的输出约定定义，不必等于 `runId`。Records 是不可变条目，当前 Artifacts 则可被后续 Run 替换。Revision 用于冲突检测，不是历史版本查询键。

查询不会执行 Steps 或修改 revision。查询需要活跃服务，通过 CLI 查询离线数据前先启动服务。失败的 Run 也可能已经提交 Records 和 Artifacts。

## 保留数据

| 存储后端 | 正式数据位置 |
| --- | --- |
| 文件 | `intloom/`，包括提交清单和不可变 Artifact/Record 文件 |
| SQLite | `intloom/storage.sqlite` 及数据库附属文件 |

进行一致的文件级备份前先停止服务，并保存完整的正式数据目录。只复制一个 Artifact 导出文件不是完整备份。当前不提供后端迁移或完整备份与恢复命令。

`.intloom/` 包含凭据、日志、安装内容和恢复检查点。删除它会放弃未完成的恢复，并改变连接身份，不能把它当作可随意删除的缓存。
