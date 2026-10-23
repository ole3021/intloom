---
title: 读取与导出结果
---

# 读取与导出结果

Workflow Code 决定提交哪些正式结果。通过运行中的 Service 读取当前 Artifacts 和追加 Records：

```sh
intloom artifacts --loom intent --limit 20 --json
intloom artifact --loom intent --stage specification
intloom artifact ART-example --output ./artifact.json
intloom records --loom intent --limit 20 --json
intloom record REC-example --json
```

Artifact 列表包含元数据，详情包含业务数据。选择 Artifact ID，或同时选择 Workflow 和 Stage。默认页大小 50，最大 200。使用 `nextCursor` 时保持筛选条件和页大小一致。

导出路径相对于命令当前目录，父目录需要存在。已有输出文件必须明确使用 `--overwrite`。导出的 JSON 包含完整存储快照。

## 当前结果与 Run 结果

后续 Run 可以替换 Artifact。Run 结果引用保存真实提交的 ID 和 revision。查看旧 Run 不会把当前详情变成历史数据；引用版本不可用时，TUI 显示 `historical_revision_unavailable`。

失败或取消的 Run 可以保留之前成功提交的结果。完成的流程也可能生成包含未解决发现的报告。参见 [Intent 结果](../intent/results.md)。

## 保留正式数据

File Storage 和 SQLite 都位于 `intloom/`，SQLite 使用 `intloom/storage.sqlite`。一致的文件级备份应先停止 Service，再复制整个正式数据目录，包括数据库附属文件。单个 Artifact 导出只是一份快照。

`.intloom/` 还包含未完成恢复和连接资源。参见[数据概念](../concepts/data.md)。
