---
title: 开发 State 与正式 Storage
---

# 开发 State 与正式 Storage

为每个 Stage 定义业务 Schema 和初始化器。宿主验证初始化输入与每次 State 写入。

## 更新完整 State

使用业务 Schema 解析 `access.state.value`，构造替换 JSON 值并 await `state.update`。`create` 要求值不存在，`clear` 删除值但不自动重新初始化。不要修改只读视图。

跨阶段上下文应根据明确保存的 Artifacts/Records 和实际 Run 身份初始化。

## 提交正式数据

只有 Code 获得可写 Storage。例如原子创建一个 Artifact 并追加一个 Record：

```ts
await access.storage.commit([
  {
    type: "create_artifact",
    id: "draft-1",
    payload: {
      flowName: "review",
      stageName: "review",
      data: { approved: true },
    },
  },
  {
    type: "append_record",
    id: "review-1",
    payload: {
      flowName: "review",
      stageName: "review",
      data: { decision: "approved" },
    },
  },
]);
```

这是 Code 函数体片段。实际执行选择唯一 ID，这些固定 ID 不能用于重复创建。

替换或删除 Artifact 需要观察到的 `expectedRevision`。批次拒绝重复的 category/ID 目标。Record 内容不可变，但 Code 可以明确删除 Record。

提交原子性覆盖传入的 Storage 操作，不包含 State 更新、文件修改、模型调用或后续步骤。失败后保留之前成功提交的证据，不假定回滚。

参见 [SDK 操作](../reference/sdk.md)和[数据概念](../concepts/data.md)。
