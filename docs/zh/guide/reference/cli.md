---
title: CLI 参考
description: CMD、TUI、项目操作与 JSON 输出。
---

# CLI 参考

要求 Node.js >=26.4.0。`intloom` 与 `intloom tui` 打开常驻 TUI，入口自动启用实验性 FFI；其他命令由 CMD 处理。两者调用同一 JSON Core，关闭客户端不会取消 Run 或停止 Service。详细参数见 `intloom <command> --help`。

全局参数：`--project`、`--json`、`--no-interactive`、`--no-color`、`--info`、`--debug`、`--version`。显式项目路径要求精确根目录，否则 CMD 向上发现最近项目。执行接受完整参数；轻量设置选择可使用 Clack。

CMD 默认输出便于阅读的文本，重定向时也相同：状态摘要、紧凑列表、初始化/诊断步骤、分层配置和业务数据，以及带时间的日志行。空结果会明确说明。错误保留错误码；部分初始化保留步骤结果，结果未知时保留原操作和实例引用。Artifact 导出显示目标路径，文件内容仍为 JSON。传入 `--json` 才输出结构化结果或 JSON Lines；MCP stdio 继续使用协议数据。

| 命令 | 行为 |
| --- | --- |
| `init [directory]` | 创建新/空项目；可重复 `--workflow`，可选 `--mcp codex`、`--start`。逐步报告结果并保留部分成功。 |
| `start`、`stop`、`status` | 启动/复用、核验释放、报告 running/stopped/unavailable；`stop --instance` 绑定目标。 |
| `doctor --execution cli\|studio\|agent_ide` | 只读就绪检查，不调用真实模型。 |
| `recover [--dry-run]` | 显式处理可清理的过期资源。 |
| `workflow list/add/remove` | 离线包管理；修改要求 Service 已停止。 |
| `flows` | 已加载流程、诊断及 CLI 就绪信息。 |
| `flow <flowName>` | 完整 `--intent` 或 `--intent-file`（`-` 读 stdin），即时返回接收回执。 |
| `runs [--flow name]`、`attach <runId>` | 当前实例列表/快照，不隐式回答。 |
| `answer <runId> --action ID` | 完整 `--answer` JSON 或 `--answer-file`，保留真实回答和动作身份。 |
| `operation <UUID> --instance ID` | 查询固定接收回执。 |
| `wait <runId>` | 默认 action_or_terminal；可选 `--until terminal`、毫秒 `--timeout`，不控制执行。 |
| `watch [runId]` | Run/项目快照，Ctrl+C 只结束观察。 |
| `cancel <runId>` | 明确取消，不回滚已提交副作用。 |
| `artifacts`、`records` | flow/stage/limit/cursor 分页；Artifact 列表不含业务内容。 |
| `artifact [ID]`、`record <ID>` | 读取正式数据；Artifact 支持流程+阶段定位及明确导出。 |
| `config show`、`config set --file FILE --revision HASH` | 安全配置投影；按版本写入完整配置，下次 Service 启动生效。 |
| `mcp init --ide codex [--plan]` | 预览/应用项目 stdio 配置，保留无关设置。 |
| `mcp serve [--ide codex]` | 双向 stdio 代理连接既有 Service，不独立创建 Runtime。 |
| `config codex` | 预览 Codex 计划。 |
| `logs [runId] [--service] [--follow]` | 读取/跟随持久日志；默认文本行，`--json` 输出 JSON/JSON Lines，可离线。 |

flow/answer 生成 UUID 并取得 Service 实例。明确复提交需同时提供原 `--operation-id`、`--instance` 与参数。写操作不自动重试；`outcome: unknown` 保留身份供回执查询。

普通 JSON 为 `{ ok: true, data, meta }` 或 `{ ok: false, error, outcome, meta, data? }`，流式输出为 JSON Lines。错误只含安全 code/message/retryable。ok 表示操作结果，Run status 表示执行结果；查询失败 Run 可返回非零，明确取消成功返回零。waiting 与 accepted 都不代表流程完成。

统计、revision 和成果引用由 Kernel 提供，限定在 Service 生命周期。人工等待暂停执行预算；外部 Agent 推理用量保持未知。TUI 显示真实提交引用，旧 Artifact 版本不可用时明确提示。更多配置、快捷键和职责见 [CLI 包说明](https://github.com/ole3021/intloom/blob/main/apps/cli/README.md)。
