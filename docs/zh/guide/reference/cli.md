---
title: CMD 命令参考
---

# CMD 命令参考

使用 `intloom COMMAND --help` 查看位置参数和已安装版本帮助。

## 全局参数

`--project PATH` 选择精确根目录，`--json` 选择机器输出。`--no-interactive` 禁用设置选择，`--no-color` 禁用颜色。`--info`/`--debug` 在 stderr 提供安全诊断。`--version`、`--help` 检查入口。

## 命令

| 命令 | 参数与行为 |
| --- | --- |
| `init [directory]` | 新/空目录；可重复 `--workflow SOURCE`，可选 `--mcp codex`、`--start`；逐项报告设置结果 |
| `start` | 可选 `--port 0..65535`；启动或复用 Service |
| `stop` | 可选 `--instance ID`；核验停止 |
| `status` | 核验后的项目 Service 状态 |
| `doctor` | `--execution cli\|studio\|agent_ide`，默认 cli；只检查就绪 |
| `recover` | 可选 `--dry-run`；处理符合条件的过期资源 |
| `workflow list` | 已安装包身份 |
| `workflow add SOURCE` | 注册表包或本地归档；要求 Service 停止 |
| `workflow remove PACKAGE` | 移除包；要求 Service 停止 |
| `flows` | 已加载 Workflow 定义与可用性 |
| `flow NAME` | `--intent TEXT` 或 `--intent-file FILE`；`-` 读取 stdin；返回接收回执 |
| `runs` | 可选 `--flow NAME`；当前实例 Run |
| `attach RUN` | 当前 Run 快照；可选 `--instance ID` |
| `answer RUN` | 必须 `--action ID`，及 `--answer JSON` 或 `--answer-file FILE`；接收回执 |
| `cancel RUN` | 可选 `--instance ID`；明确取消 |
| `operation UUID` | 可选 `--instance ID`；不可变接收回执 |
| `wait RUN` | `--until action_or_terminal\|terminal`、正数毫秒 `--timeout`、可选 `--instance` |
| `watch [RUN]` | 项目或 Run 快照；可选 `--instance`；Ctrl+C 结束观察 |
| `artifacts` / `records` | 可选 `--flow`、`--stage`、`--limit 1..200`、`--cursor` |
| `artifact [ID]` | ID 或 `--flow` 加 `--stage`；`--output FILE`，可选 `--overwrite` |
| `record ID` | 读取 Record 详情 |
| `config show` | 安全配置及 revision |
| `config set` | 必须 `--file FILE --revision HASH`；完整替换 |
| `config codex` | 预览 Codex 配置计划 |
| `mcp init` | `--ide codex`，可选 `--plan` |
| `mcp serve` | stdio 代理；可选 `--ide codex`；连接已有 Service |
| `logs [RUN]` | 可选 `--service`、`--follow`；文本或 JSON Lines |
| `mirror list` / `mirror inspect ID` | 列出边界或检查原始镜像 |
| `mirror restore ID` | 必须 `--to PROJECT`；`--scope step\|stage\|workflow`，默认 workflow；可选 `--dry-run` |
| `mirror export TRACE` | 必须 `--to NEW-DIRECTORY` |
| `run resume RUN` | 可选 `--scope`、`--revision`；`--abandon-mirror` 要求 workflow 范围 |
| `tui` | 常驻 TUI，也是无子命令入口 |

## 写入身份与输出

`flow`、`answer`、`run resume` 明确重放时同时接受 `--instance` 与 `--operation-id`，必须保留原参数。Resume 还绑定观察到的 Run revision。

普通 JSON 为 `{ ok: true, data, meta }` 或 `{ ok: false, error, outcome, meta, data? }`。错误 outcome 为 `not_applied`、`applied`、`unknown`。Meta 保留已知请求、项目、实例、操作和 Run 身份。回执状态与 Run 状态独立。

流式输出使用 JSON Lines，非 JSON 输出为可读文本。查询默认页大小 50。导出在本地写入 JSON，除非明确覆盖，否则独占创建文件。

参见 [CMD 指南](../usage/cmd.md)、[Run 操作](../usage/runs.md)和[镜像](../usage/mirrors.md)。
