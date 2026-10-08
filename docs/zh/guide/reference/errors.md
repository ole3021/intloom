---
title: 错误与兼容性
description: 理解分类错误，避免错误假设取消、回滚或重放是安全的。
---

# 错误与兼容性

面向用户的错误包含 `code`、`message` 和 `retryable`。公开错误信息不包含内部原因或凭据。`retryable` 不意味着可以重放非幂等操作，例如创建 Run 或重复结果不确定的操作。

## 请求与服务错误

| 错误码 | 含义与下一步 |
| --- | --- |
| `INVALID_REQUEST` | 输入、配置或必需凭据无效，修正后再尝试 |
| `NOT_FOUND` | 请求的身份或资源不存在 |
| `CONFLICT` | revision 过期、所有权竞争、身份重复或状态变化，先重新读取再决定 |
| `BUSY` | 当前操作由其他所有者占用，只按该操作约定的身份规则重试 |
| `STORAGE_ERROR` | Storage 失败，不能盲目重放结果不确定的提交 |
| `KERNEL_UNAVAILABLE` | 加载、准备或执行可用性失败，请检查诊断 |

具体错误实例可以覆盖错误目录的默认值，请检查实际返回的错误码和是否可重试。

## Run 与执行错误

| 错误码 | 含义 |
| --- | --- |
| `RUN_STOPPED` | 明确停止的 Run，终端界面显示 Stopped |
| `RUN_INTERRUPTED` | 不受支持或结果不确定的重启边界，检查先前影响 |
| `RUN_CHECKPOINT_FAILED` | 无法保存恢复检查点，执行已停止 |
| `STAGE_STATE_INVALID` | State 不符合 Schema 或 JSON 边界 |
| `STAGE_STATE_EXISTS` / `STAGE_STATE_NOT_FOUND` | State 创建或更新的前置条件不满足 |
| `STAGE_STATE_INACTIVE` / `EXECUTION_OWNERSHIP_LOST` | 能力或结果属于已经失效的执行 |
| `STEP_OUTCOME_NOT_HANDLED` / `INVALID_TRANSITION` | 返回的 outcome 没有有效路由 |
| `STEP_RESULT_INVALID` | 最终结果不符合仅包含 outcome 的对象要求 |
| `LLM_REQUEST_FAILED` | 提供商请求失败，检查协议、端点、凭据和可用性 |
| `LLM_RESPONSE_INVALID` | 无法解析或验证提供商响应 |
| `AGENT_OUTPUT_INVALID` | Agent 结构化输出验证失败 |
| `TOOL_EXECUTION_FAILED` | 已声明 Tool 或绑定能力执行失败 |
| `STEP_EXECUTION_FAILED` | Step 失败，包括模型未提供完整最终响应就结束 |

这些是常见类别，不是所有包定义业务错误的完整列表。检查 Run 游标、日志和 Workflow 上下文以确定具体原因。之前的提交成功后再失败，不会撤销此前提交。

## CLI 与客户端错误

`CLI_INIT_TARGET_NOT_EMPTY` 用于保护已有文件，请使用新建或空的初始化目录。

`CLI_OUTPUT_EXISTS` 用于保护已有导出文件，请在选择 `--overwrite` 前审核。`CLI_ARTIFACT_EXPORT_FAILED` 表示本地输出发布失败，不会修改存储结果。

`PROJECT_CONNECTION_FAILED`、`PROJECT_REQUEST_FAILED`、`PROJECT_RESPONSE_INVALID` 和 `PROJECT_CLIENT_CLOSED` 属于 Node.js 客户端边界。请求结果不确定时先查询已有任务，不要自动创建另一个 Run。

Compiler 错误见 [Compiler 参考](./compiler.md)。

## 兼容性检查

- 独立于 npm 版本，匹配当前 `2026-10-08` Workflow 协议。
- 修改 CLI 或包后重启服务，已加载资源不会热重载。
- 为未完成检查点保留精确的 Workflow 资源。
- 测试实际提供商和模型对 Tools、输出 Schema 和输出预算的支持。
- 用服务中的可执行程序版本验证业务检查命令。Node 26 不接受过时的 `--experimental-transform-types` 参数。
- 将原生表单界面验证与 MCP Tool 传输成功分别验证。

诊断顺序见[日志与诊断](../usage/diagnostics.md)，中断任务处理见[恢复](../usage/recovery.md)。

