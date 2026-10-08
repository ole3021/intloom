---
title: State 与正式 Storage
description: 验证草稿，原子提交正式结果，并处理 revision 冲突。
---

# State 与正式 Storage

正在处理的业务草稿放在 Stage State 中；结果需要成为正式项目数据时，使用 Storage。更新 State 不会自动保存 Artifact 或 Record。

## 定义 JSON State

```ts
import * as z from "zod";

export default z.strictObject({
  runId: z.string(),
  intent: z.string(),
  approved: z.boolean().default(false),
});
```

初始化器返回 Schema 输入。创建、更新和恢复都会验证 Schema 和 JSON 边界。日期使用序列化字符串，省略 undefined 字段；函数、类实例和执行能力不应进入 State。

`access.state.value` 是读取视图。`update(next)` 替换已有的完整值，不合并补丁。`create` 要求当前没有值，`clear` 是幂等操作。更新失败会保留原值，清空不会重新运行初始化器。

区分模型提案和 Code 管理的字段。Zod 可以验证结构，但应用 Code 仍需要验证引用、来源版本、确认所有权和业务规则。

## 提交 Artifacts 和 Records

Code Step 可以在一个原子批次中写入相关结果：

```ts
await access.storage.commit([
  {
    type: "create_artifact",
    id: artifactId,
    payload: { flowName, stageName, data: result },
  },
  {
    type: "append_record",
    id: recordId,
    payload: { flowName, stageName, data: changeRecord },
  },
]);
```

这是 `ExecutableCode` 内的代码片段，标识符和 JSON 载荷由 Workflow 定义。Artifact 在其 Workflow/Stage 位置唯一。替换时先读取当前 revision，再使用带 `expectedRevision` 的 `replace_artifact`，不要用删除后重建来绕过冲突检查。

不可变 Record 可以追加或显式删除，但不能替换。Agent Tools 只获得 `StorageReadAccess`；正式提交属于 Code 的职责。

## 处理失败边界

原子性只覆盖 Storage 批次，不包括项目文件修改、模型请求、State 更新或检查点写入。成功提交后，即使后续操作失败，提交仍然保留。

如果工作流支持可重复的 finalize 路径，应使用确定性身份，并在将重试视为已完成前验证已有的已提交载荷。结果未知时，不要盲目重放提交。框架不提供失败 Run 的自动重试。

操作依赖早期 Artifact 时，在 State 中保存基准 revision 或摘要。等待后和提交前重新验证，其他参与者可能已经修改正式数据。

## 明确查询行为

Storage 读取缺失条目时返回 `undefined`。CLI 和 ProjectClient 将缺失详情规范为 `null`。列表返回 `{ data, nextCursor? }`，默认条数为 50，最大为 200。使用游标时保持筛选条件和条数限制不变。

后续 Stage 应读取已提交的上游数据，不依赖前一个 Stage 已释放的内存值。操作接口见 [SDK 参考](../reference/sdk.md)，用户查询方式见[结果](../usage/results.md)。

