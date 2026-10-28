---
title: MCP Tools 与 Agent 任务协议
---

# MCP Tools 与 Agent 任务协议

新版 Loom 的 JSON 输入、正式 output、models 三档配置、命名交互及 new/check/inspect 命令见 [Loom Package 0.10](./loom-package.md)。旧调用与配置仍兼容。


外部 Service 端点为经认证的 loopback `/mcp` 和 `/mcp/codex`。安装后的 stdio 代理处理发现与凭据。内部 CLI/Studio 入口选择不同来源策略，不用外部端点替代。

## Loom 与结果 Tools

| Tool | 输入 | 结果 |
| --- | --- | --- |
| `run` | `loomName, input, operationId, serviceInstanceId` | `receipt, run?` |
| `list_looms` | 空对象 | `looms` |
| `get_run` | `runId` | `run`, optional `presentation` |
| `list_runs` | 可选 `loomName` | `runs` |
| `answer_ask` | `runId, actionId, answer, operationId, serviceInstanceId` | `receipt, run?` |
| `interact` | `runId, actionId, operationId, serviceInstanceId` | 原生交互或操作/Run |
| `cancel_run` | `runId, operationId, serviceInstanceId` | `receipt, run?` |
| `status` | 空对象 | `service` |
| `get_artifact` | `artifactId` 或 `loomName, stageName` | `artifact` |
| `list_artifacts` | 可选 `loomName, stageName, limit, cursor` | `artifacts` 分页 |
| `get_record` | `recordId` | `record` |

Artifact/Record 不存在时详情返回 `null`。列表包含 Artifact 元数据，详情包含业务内容。业务错误设置 `isError: true`。客户端需要处理 structured content 或 JSON text，以及协商后的原生交互。

## 外部 Agent Tools

| Tool | 附加字段 |
| --- | --- |
| `get_agent_call` | `runId, callId` |
| `claim_agent_call` | 任务引用加 `claimId` |
| `call_agent_tool` | 所有者引用加 `toolCallId, toolId, input` |
| `read_agent_asset` | 所有者引用加 `assetId` |
| `complete_agent_call` | 所有者引用加 `result` |
| `fail_agent_call` | 所有者引用加 `message` |

所有者引用为 `{ runId, callId, ownerToken }`。使用 `pendingAgentCall.id` 作为 callId。生成稳定唯一 claimId；认领返回任务指令、Skills、Tools、输出 Schema 和私有 ownerToken。

串行执行声明 Tools。保留各 toolCallId；相同 ID 和输入重试返回原回执，改变输入会冲突。每个任务最多保存 256 个回执，声明附件读取限 1 MiB。

所有 Tools 完成后，提交满足任务输出 Schema 输入形状的原始最终 JSON。完成提交返回 `{ receipt: { runId, callId, status: "accepted" } }`；之后查询 `get_run`，判断流程是否继续或结束。`endTool` 只关闭本次调用的业务 Tools，仍需提交最终结果。

活跃调用的回执不会被淘汰；达到 256 个回执后拒绝新 Tool 调用。调用关闭且未结束的 Tool 活动收敛后，回执保留 30 分钟。取消会撤销执行权限，但不会撤销已发生的副作用；重启不会重放外部 Agent。

## 人工操作

问题使用完整 `{ questionId, isSkipped, answer? }` 数组。确认使用 `{ isConfirmed, feedback? }`。`interact` 尝试原生呈现，回退时收集真实回答并调用 `answer_ask`。关闭交互保留等待。

## 镜像 Tools

| Tool | 输入 |
| --- | --- |
| `mirror_list` | 空对象 |
| `mirror_inspect` | `mirrorId` |
| `mirror_restore` | `mirrorId, targetProject, scope`；可选 `dryRun` |
| `mirror_export` | `traceId, targetProject` |
| `resume_run` | `runId, operationId, expectedRevision, serviceInstanceId`；可选 `scope, abandonMirror` |

镜像和 trace ID 是 UUID。Resume 绑定当前实例和观察 revision，响应不确定时保留精确身份。

取消使 Agent 所有权失效，重启无法恢复进行中的外部任务。参见 [MCP 指南](../usage/mcp.md)、[人工回答](../usage/runs.md)和[镜像](../usage/mirrors.md)。

## 操作回执与历史查询

先调用 `status`，使用返回的 `service.instanceId`。`run`、`answer_ask`、`cancel_run`、`pause_run`、`resume_run` 共享 operations 回执；`interact` 只有取得真实回答时才提交 answer 操作。客户端生成 UUID operationId，同一身份重试必须保留原参数和来源入口。

| Tool | 输入 | 结果 |
| --- | --- | --- |
| `pause_run` | `runId, operationId, serviceInstanceId` | `receipt, run?` |
| `get_operation` | `operationId, serviceInstanceId` | `found` 和回执、`not_found` 或 `instance_changed` |
| `find_run` | 原始 `operationId, serviceInstanceId` | `run` 或 null |

回执状态为 `pending`、`accepted`、`rejected`、`indeterminate`，保留到当前 Service 实例结束。`accepted` 只说明操作已受理，随附 Run 是独立的当前视图。`rejected` 表示未应用；`indeterminate` 表示副作用不能确定，不能按“失败”重新提交。

暂停请求在当前 Step 完成后生效，并保存结果；resume 使用已保存结果继续路由，不重复 Code。重启后旧操作回执查询返回 `instance_changed`，不能据此重放。`find_run` 可按持久化的发起身份查找原 Run，`list_runs` 包含保留的终态历史，标记 `historical: true`。历史只读。

可选 App 工具、私有视图授权、标准交互降级及普通浏览器接入见 [Loom Apps](./loom-apps.md)。
