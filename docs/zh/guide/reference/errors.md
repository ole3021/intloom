---
title: 错误码
---

# 错误码

安全错误包含 code、message、retryable。结合当前操作和 Run 判断；retryable 不授权重复结果未知的副作用。

| 错误码 | 含义 |
| --- | --- |
| INVALID_REQUEST | 输入、配置或凭据前提不满足 |
| NOT_FOUND | 身份或资源不存在 |
| CONFLICT | 版本过期、状态改变或身份竞争 |
| BUSY | 其他操作占有资源 |
| STORAGE_ERROR | 正式持久化失败 |
| KERNEL_UNAVAILABLE | 资源或执行不可用 |
| RUN_STOPPED | 明确取消 |
| RUN_INTERRUPTED | 不支持或不确定的重启边界 |
| RUN_CHECKPOINT_FAILED | 无法保存继续执行检查点 |
| STAGE_STATE_INVALID | Schema/JSON 验证失败 |
| STAGE_STATE_EXISTS / STAGE_STATE_NOT_FOUND | State 写入前提不满足 |
| STAGE_STATE_INACTIVE / EXECUTION_OWNERSHIP_LOST | 能力或结果已过期 |
| STEP_OUTCOME_NOT_HANDLED / INVALID_TRANSITION | outcome 路由无效 |
| STEP_RESULT_INVALID | Code 结果不是仅含 outcome |
| LLM_REQUEST_FAILED / LLM_RESPONSE_INVALID | 提供方请求或响应失败 |
| AGENT_OUTPUT_INVALID | 最终结构化输出验证失败 |
| TOOL_EXECUTION_FAILED / STEP_EXECUTION_FAILED | Tool 或 Step 失败 |
| CLI_SERVICE_PROTOCOL_MISMATCH | 预期 Service API 返回非 JSON 的 HTTP 404；检查 CLI/Service 兼容性并手动停止、启动以重新加载 |
| CLI_RESULT_INVALID | 响应 JSON、结果结构或项目/实例/请求身份无效 |
| CLI_SERVICE_UNAVAILABLE | HTTP 拒绝且没有有效业务结果 |
| CLI_SERVICE_OFFLINE / CLI_SERVICE_TIMEOUT | 连接失败 / 响应超时 |
| REQUEST_OUTCOME_UNKNOWN | 已发送写入没有有效回执；再次提交前查询原 operation |
| CLI_INIT_TARGET_NOT_EMPTY | 初始化目标包含文件 |
| CLI_OUTPUT_EXISTS / CLI_ARTIFACT_EXPORT_FAILED | 本地导出失败 |
| MCP_CONFIG_INVALID / MCP_CONFIG_CONFLICT | 客户端配置无效或冲突 |
| MIRROR_RESTORE_FAILED | 镜像无法恢复到准备的目标 |

这是常见分类，不包含所有 Workflow 业务错误。结合 lastError、游标、日志和之前提交判断。

传输错误可能报告 `outcome: unknown`，同时执行仍继续。重试前查询原 Run 或 operation 身份。失败前的提交和文件修改可能已经生效。

Compiler 错误见 [Compiler](./compiler.md)，诊断顺序见[故障排查](../help/troubleshooting.md)。
