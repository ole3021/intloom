---
title: MCP Tools 与 Agent 任务协议
---

# MCP Tools 与 Agent 任务协议

外部 Service 端点为经认证的 loopback `/mcp` 和 `/mcp/codex`。安装后的 stdio 代理处理发现与凭据。内部 CLI/Studio 入口选择不同来源策略，不用外部端点替代。

## Workflow 与结果 Tools

| Tool | 输入 | 结果 |
| --- | --- | --- |
| `flow` | `flowName, intent` | `run` |
| `list_workflows` | 空对象 | `workflows` |
| `get_run` | `runId` | `run` |
| `list_runs` | 可选 `flowName` | `runs` |
| `answer_ask` | `runId, actionId, answer` | `run` |
| `interact` | `runId, actionId` | 原生交互或操作/Run |
| `cancel_run` | `runId` | `run` |
| `status` | 空对象 | `service` |
| `get_artifact` | `artifactId` 或 `flowName, stageName` | `artifact` |
| `list_artifacts` | 可选 `flowName, stageName, limit, cursor` | `artifacts` 分页 |
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

所有 Tools 完成后，提交满足任务输出 Schema 输入形状的原始最终 JSON。跟随返回 Run，不创建另一 flow。认领和 Tool 回执是活进程保证，不是跨重启持久重放。

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
