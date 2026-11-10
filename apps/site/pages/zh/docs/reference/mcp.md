# MCP 工具与资源

0.4.0 的 HTTP 入口提供 20 个固定工具。通过 `tools/list` 可以取得准确参数 Schema。工具名称在不同能力包之间保持一致。各 Loom 的业务输入契约由已安装清单提供。[客户端连接说明](../use/mcp)

| 操作 | 工具 |
| --- | --- |
| 发现能力 | `intloom_looms_list`、`intloom_loom_get` |
| 控制运行 | `intloom_run_create`、`intloom_run_start`、`intloom_run_resume`、`intloom_run_stop` |
| 观察运行 | `intloom_runs_list`、`intloom_run_get`、`intloom_run_result`、`intloom_run_events`, `intloom_run_activity` |
| 处理交互 | `intloom_interactions_list`、`intloom_interaction_get`、`intloom_interaction_respond`、`intloom_interaction_prompt` |
| 读取文件 | `intloom_artifacts_list`、`intloom_artifact_get`、`intloom_artifact_read` |
| 查询验收 | `intloom_acceptances_list`、`intloom_acceptance_get` |

## 文件与回应

用 `resources/list` 查找不可变文件，把形如 `intloom://artifacts/ARTIFACT_ID` 的 URI 交给 `resources/read`。大文件用 `intloom_artifact_read` 分段读取，按每次返回的实际长度向后移动，直到 `eof`。需要完整落盘时可以用 CLI 导出。

`intloom_interaction_respond` 记录 Agent 回答。通过原生表单确认提交可以记录人工回答。查询工具只读取状态。工具成功时，`structuredContent` 包含 `ok: true` 和 `data`；已知操作失败时返回 `isError: true` 和结构化错误。包需先通过 CLI 或 SDK 安装，之后才能用 MCP 找到。
