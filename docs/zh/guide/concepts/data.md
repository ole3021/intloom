---
title: State、Artifact、Record 与 Storage
---

# State、Artifact、Record 与 Storage

| 数据 | 用途与生命周期 |
| --- | --- |
| Stage State | 当前 Stage 访问内可变的业务工作区 |
| Artifact | 带 revision 的当前正式 Workflow/Stage 输出 |
| Record | 追加的不可变业务条目 |
| Run 观察数据 | 实例内状态、活动、统计和结果引用 |

State 写入由 Stage Schema 验证。`create` 要求不存在，`update` 替换完整值，`clear` 幂等。State 不会自动复制到另一个 Stage，也不会自动提交为 Artifact。

## 正式持久化

Workflow Code 在一个 Storage 批次内原子提交 Artifact/Record 操作。宿主提供 File 或 SQLite 实现。该原子性与 State 更新、项目文件、模型调用和其他外部副作用分别管理。

Artifact 支持 revision 检查后替换；当前值不是完整版本归档。Record 保留追加条目。ID 和业务内容由 Workflow 选择。

## 检查点与镜像

Runtime 检查点保存受支持的继续执行边界和业务 State，排除旧统计，不能恢复原 Promise。镜像增加正式 Storage 和声明的本地文件，用于独立暂停重放。

日志提供诊断，不重建 State。参见[结果](../usage/results.md)、[State/Storage 开发](../development/state-storage.md)和[镜像](../usage/mirrors.md)。
