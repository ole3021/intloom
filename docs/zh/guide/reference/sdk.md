---
title: Loom SDK 参考
---

# Loom SDK 参考

从 `@intloom/loom-sdk` 导入公开契约，无需子路径或私有 Kernel 依赖。

## 定义与执行

| 契约 | 含义 |
| --- | --- |
| `Blueprint`、`BlueprintStage` | 初始化拓扑、入口、路由、Stage Schema/初始化器 |
| `StageStateInitializer` | Stage 进入时从 Run 上下文生成 JSON Schema 输入 |
| `LoomModule` | 命名导出 `blueprint`、`codes`、`agentSpecs` |
| `ExecutableCode` | `code(access)` 及可选 `recover(saved, access)` |
| `StepResult` | 只含 `outcome: string` |
| `CodeExecutionAccess` | State、可写 Storage、交互、signal、可选 Project |
| `AgentExecutionAccess` | State、只读 Storage、signal、可选 Project |

## StateAccess

`value` 为递归只读视图或 undefined。`create(value)` 要求不存在，`update(value)` 替换已有 State，`clear()` 幂等。宿主解析写入，失败保留原值。

## Storage

只读能力提供 getArtifact(loomName, stageName)、getArtifactById、getLatestRecord、getRecordById、listArtifacts、listRecords。SDK 缺失读取返回 undefined，列表为 `{ data, nextCursor? }`。

可写能力增加 `commit(operations)`。操作为 create_artifact、replace_artifact、append_record、remove_artifact、remove_record。替换或删除 Artifact 要求 expectedRevision。结果报告 writtenArtifacts、appendedRecords 和移除 ID。

`StorageQuery` 支持 loomName、stageName、ids、createdAfter/Before、order、limit、cursor，范围比客户端列表参数更广。

## 交互与 Tools

`InteractionAccess.askQuestions` 返回完整回答数组，`confirm` 返回 isConfirmed 和可选 feedback。Runtime 管理操作身份和生命周期，Loom Code 管理业务确认规则。

`defineAgentTool` 推导解析输入和原始输出。`AgentTool<Input, Output, RawOutput = Output>` 区分解析输出与 execute 返回值，宿主解析器和 JSON 检查强制边界。

Tool 显式接收 `access`。框架上下文绑定属于 Kernel，不再作为 SDK 公开接口。

## ProjectAccess 与生命周期

`snapshot`、`read`、`write`、`remove`、`run` 提供宿主绑定工程操作。命令使用参数数组及可选 cwd/timeoutMs，结果保留 exitCode、stdout/stderr、超时与截断信息。

所有 access 属于当前调用。操作需要 await，之后不保留能力。参见[开发教程](../development/create.md)和 [State/Storage](../development/state-storage.md)。

## 输入、Agent 与产物协议

SDK 仅依赖 Zod。固定输入为 `prompt`、`files`、`dirs`、`urls`，声明的每个输入槽都必填，未声明的槽被拒绝。`parseLoomInput` 校验并分离输入，文件/目录/URL 引用不会自动执行读取。

Agent 模型用途为 `thinking`、`working`、`coding`。`AgentSpec.outputSchema` 的解析结果必须符合 `StepResult`；宿主继续校验实际结果与路由。`endsAgent(output)` 可在 Tool 成功提交临时结果后关闭本次调用的后续 Tools，但不会提交正式数据或替代最终 outcome。

当前产物协议为 `2026-10-15`，写入 `package.json.loom` 的 `type: loom` 和 `version`。`loomModuleSchema` 只验证产物结构，不执行 Code、Tool、初始化器或业务 Schema。`loomNameSchema`、`codeIdSchema`、`agentIdSchema` 是公共标识规则。Compiler 生成稳定 ID；Kernel 检查引用、资源与注册冲突。

## 恢复与边界

`CodeRecovery` 按 `kind` 区分问题和确认，包含 `actionId`、对应类型的 `request` 和 `answer`。`codeRecoverySchema` 校验此结构；宿主额外校验操作归属和回答完整性，Loom 仍需检查当前业务版本与原请求一致。恢复不得重放等待前的副作用。

`Cursor`、存储快照类型和 Agent 框架上下文属于 Kernel；废弃的 `Query`、`SnapshotCategory` 别名已移除。旧协议产物需要重新构建并安装。
