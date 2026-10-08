---
title: Workflow SDK 参考
description: 公开的执行、State、Storage、交互和 Agent Tool 契约。
---

# Workflow SDK 参考

从 `@intloom/workflow-sdk` 导入公开 Workflow 契约。它依赖 Utils 和 Zod，不依赖私有 Kernel、模型提供商、数据库驱动或 Mastra。

## 定义与执行类型

| 导出 | 契约 |
| --- | --- |
| `Blueprint` | `flowName`、可选 `exclusive`、入口 Stage 和 Stage 定义 |
| `BlueprintStage` | State Schema、初始化器、入口 Step、Steps 和 Stage outcome 路由 |
| `BlueprintStep` | Code/Agent 执行引用和 Step outcome 路由 |
| `StageStateInitializer` | 接收 Run/Workflow/Stage 身份和意图，同步或异步返回 JSON Schema 输入 |
| `StepResult` | `{ readonly outcome: string }` |
| `ExecutableCode` | `(input, access) => StepResult \| Promise<StepResult>`，可带 `recover(saved, access)` |
| `AgentSpec` | 指令、模型角色、输出 Schema、Skills 和已声明 Tools |
| `WorkflowModule` | 命名的 `blueprint`、`codes` 和 `agentSpecs` 资源 |

`CodeRecovery` 包含已保存操作 `{ id, kind, request }` 和接受的答案。恢复函数使用恢复后的 State 和新的访问能力，不使用原函数的局部变量。

## StateAccess

| 成员 | 行为 |
| --- | --- |
| `value` | 只读业务值，不存在时为 `undefined` |
| `create(value)` | 仅在不存在时创建，并用 Stage Schema 验证 |
| `update(value)` | 替换完整的已有值，不隐式合并 |
| `clear()` | 幂等移除值，不自动重新初始化 |

`CodeExecutionAccess` 包含 State、可写 Storage、交互、取消信号和可选项目访问。`AgentExecutionAccess` 包含 State、只读 Storage、信号和可选项目访问。能力随执行结束而失效。

## StorageReadAccess

- `getArtifact(flowName, stageName)` 和 `getArtifactById(id)` 返回已存储 Artifact 或 `undefined`。
- `getLatestRecord(flowName, stageName)` 和 `getRecordById(id)` 返回已存储 Record 或 `undefined`。
- `listArtifacts(query)` 和 `listRecords(query)` 返回 `{ data, nextCursor? }`。

`StorageQuery` 接受 `flowName`、`stageName`、`ids`、`createdAfter`、`createdBefore`、`order`、`limit` 和 `cursor`。排序为 `created_asc` 或默认的 `created_desc`。条数默认 50，不能超过 200。游标查询参数需要保持一致。公开 CLI 的查询范围更窄。

`StoredArtifact` 包含 `id`、`flowName`、`stageName`、正数 `revision`、JSON `data` 和创建、更新时间。`StoredRecord` 包含相同的身份、位置和数据字段及创建时间，没有 revision。

## StorageAccess.commit

`commit(operations)` 提交原子批次。同一类别和 ID 中的重复目标无效。

| 操作 `type` | 必需数据 |
| --- | --- |
| `create_artifact` | `id`、`payload` |
| `replace_artifact` | `id`、`expectedRevision`、`payload` |
| `append_record` | `id`、`payload` |
| `remove_artifact` | `id`、`expectedRevision` |
| `remove_record` | `id` |

`payload` 为 `{ flowName, stageName, data }`。结果包含 `writtenArtifacts`、`appendedRecords`、`removedArtifactIds` 和 `removedRecordIds`。Revision 检查防止过期替换或移除，不提供历史读取。

## InteractionAccess

`askQuestions(questions)` 接受非空扁平数组。每个问题包含 `id`、`question`、`isSkippable`、可选 `description`，以及可选的 `{ id, label, description? }` 选项。答案使用 `questionId`、`isSkipped`，未跳过时包含答案文本。

`confirm(context)` 返回 `{ isConfirmed, feedback? }`。导出的 `userAskQuestionsSchema`、`userAnswerQuestionsSchema`、`userAskConfirmationSchema` 和 `userAnswerConfirmationSchema` 定义 JSON 契约。必需反馈等业务规则仍由 Workflow 负责。

## AgentTool

`defineAgentTool({ id, description, inputSchema, outputSchema, execute })` 保留 Zod 类型推断。`execute(input, access)` 可同步或异步执行。原始解析器在服务中执行，客户端描述包含 JSON Schemas。

`AgentTool<Input, Output, RawOutput = Output>` 分别表示解析后的输入、解析后的输出和原始输出。`execute` 接收输入 Schema 解析后的值，返回输出 Schema 的输入；服务再将返回值解析成最终结果。输出 Schema 为 `z.string().transform(Number)` 时，`execute` 应返回字符串，而不是解析后的数字。辅助函数从 Schemas 推断这些类型，不会为了容纳错误实现而拓宽类型。输出 Schema 的输入与输出类型相同时，现有的两个泛型参数写法仍适用。

无法表示输出结构的输出转换，会对外描述为不受约束。客户端需要明确形状时，在转换之后使用显式输出 Schema，例如 `.pipe(z.number())`。Tool 结果和解析后的最终 Agent 结果必须满足 JSON 边界。

`getAgentExecutionAccess(context)` 读取 `intloom.execution` 绑定，供适配器集成使用。它验证全部必需的 State/Storage 方法、State 的 value 成员、取消信号及可选 Project 方法，并拒绝可写 Storage 和交互能力。验证过程不会读取业务 State 或调用能力方法。无效绑定、查询和检查失败统一使用 `STEP_EXECUTION_FAILED`。普通 SDK Tools 直接获得访问能力，不需要框架特定的请求上下文。能力生命周期仍由服务执行检查。

## ProjectAccess

方法为 `snapshot()`、`read(path)`、`write(path, content)`、`remove(path)` 和 `run(command, signal?)`。项目访问是可选能力，其根目录和生命周期绑定到服务。

`ProjectCommand` 包含 `command`、`args`、可选 `cwd` 和可选 `timeoutMs`。结果包含该命令、`exitCode`、`stdout`、`stderr`、`timedOut` 和 `truncated`。命令不会隐式使用 shell 解析。

CLI 服务将文本操作限制为 1 MiB，文件快照限制为 10,000 个文件且单文件最多 16 MiB，命令超时最多 300 秒，默认 60 秒。它拒绝符号链接，并从快照中排除生成和私有路径，包括 `.git`、`.intloom`、`intloom`、`node_modules`、`dist`、`coverage`、`.turbo`、`.env*`、`.dev.vars*` 和 IntLoom 配置。因此，快照不是对进程可访问全部文件的完整审计。

## 元数据与兼容性

`workflowProtocolVersion` 为 `2026-10-08`；`workflowMetadataSchema` 验证协议声明。协议版本和 npm 包版本用途不同。`Query` 和 `SnapshotCategory` 是已弃用的别名，新代码应使用 `StorageQuery` 和 `StorageCategory`。
