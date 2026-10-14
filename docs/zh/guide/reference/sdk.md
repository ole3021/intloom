---
title: Workflow SDK 参考
---

# Workflow SDK 参考

从 `@intloom/workflow-sdk` 导入公开契约，无需子路径或私有 Kernel 依赖。

## 定义与执行

| 契约 | 含义 |
| --- | --- |
| `Blueprint`、`BlueprintStage` | 初始化拓扑、入口、路由、Stage Schema/初始化器 |
| `StageStateInitializer` | Stage 进入时从 Run 上下文生成 JSON Schema 输入 |
| `WorkflowModule` | 命名导出 `blueprint`、`codes`、`agentSpecs` |
| `ExecutableCode` | Code 调用及可选恢复入口 |
| `StepResult` | 只含 `outcome: string` |
| `CodeExecutionAccess` | State、可写 Storage、交互、signal、可选 Project |
| `AgentExecutionAccess` | State、只读 Storage、signal、可选 Project |

## StateAccess

`value` 为递归只读视图或 undefined。`create(value)` 要求不存在，`update(value)` 替换已有 State，`clear()` 幂等。宿主解析写入，失败保留原值。

## Storage

只读能力提供 getArtifact(flowName, stageName)、getArtifactById、getLatestRecord、getRecordById、listArtifacts、listRecords。SDK 缺失读取返回 undefined，列表为 `{ data, nextCursor? }`。

可写能力增加 `commit(operations)`。操作为 create_artifact、replace_artifact、append_record、remove_artifact、remove_record。替换或删除 Artifact 要求 expectedRevision。结果报告 writtenArtifacts、appendedRecords 和移除 ID。

`StorageQuery` 支持 flowName、stageName、ids、createdAfter/Before、order、limit、cursor，范围比客户端列表参数更广。

## 交互与 Tools

`InteractionAccess.askQuestions` 返回完整回答数组，`confirm` 返回 isConfirmed 和可选 feedback。Runtime 管理操作身份和生命周期，Workflow Code 管理业务确认规则。

`defineAgentTool` 推导解析输入和原始输出。`AgentTool<Input, Output, RawOutput = Output>` 区分解析输出与 execute 返回值，宿主解析器和 JSON 检查强制边界。

`getAgentExecutionAccess` 检查框架适配器的 `intloom.execution` 绑定，普通 Tools 直接接收 access。

## ProjectAccess 与生命周期

`snapshot`、`read`、`write`、`remove`、`run` 提供宿主绑定工程操作。命令使用参数数组及可选 cwd/timeoutMs，结果保留 exitCode、stdout/stderr、超时与截断信息。

所有 access 属于当前调用。操作需要 await，之后不保留能力。参见[开发教程](../development/create.md)和 [State/Storage](../development/state-storage.md)。
