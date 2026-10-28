---
title: CMD 命令参考
---

# CMD 命令参考

新版 Loom 的 JSON 输入、正式 output、models 三档配置、命名交互及 new/check/inspect 命令见 [Loom Package 0.10](./loom-package.md)。旧调用与配置仍兼容。


使用 `intloom COMMAND --help` 查看位置参数和已安装版本帮助。

## 全局参数

`--project PATH` 选择精确根目录，`--json` 选择机器输出。`--no-interactive` 禁用设置选择，`--no-color` 禁用颜色。`--info`/`--debug` 在 stderr 提供安全诊断。`--version`、`--help` 检查入口。

## 命令

| 命令 | 参数与行为 |
| --- | --- |
| `init [directory]` | 新/空目录；可重复 `--loom SOURCE`，可选 `--mcp codex`、`--start`；逐项报告设置结果 |
| `start` | 可选 `--port 0..65535`；启动或复用 Service |
| `stop` | 可选 `--instance ID`；核验停止 |
| `status` | 核验后的项目 Service 状态 |
| `doctor` | `--execution cli\|studio\|agent_ide`，默认 cli；只检查就绪 |
| `recover` | 可选 `--dry-run`；处理符合条件的过期资源 |
| `loom list` | 已安装包身份 |
| `loom add SOURCE` | 注册表包或本地归档；要求 Service 停止 |
| `loom remove PACKAGE` | 移除包；要求 Service 停止 |
| `looms` | 已加载 Loom 定义与可用性 |
| `run NAME` | `--prompt TEXT` 或 `--prompt-file FILE`；`-` 读取 stdin；返回接收回执 |
| `runs` | 可选 `--loom NAME`；活跃 Run 与保留的终态历史 |
| `attach RUN` | 当前 Run 快照；可选 `--instance ID` |
| `answer RUN` | 必须 `--action ID`，及 `--answer JSON` 或 `--answer-file FILE`；接收回执 |
| `cancel RUN` | 可选 `--instance ID`；明确取消 |
| `operation UUID` | 可选 `--instance ID`；不可变接收回执 |
| `wait RUN` | `--until action_or_terminal\|terminal`、正数毫秒 `--timeout`、可选 `--instance` |
| `watch [RUN]` | 项目或 Run 快照；可选 `--instance`；Ctrl+C 结束观察 |
| `artifacts` / `records` | 可选 `--loom`、`--stage`、`--limit 1..200`、`--cursor` |
| `artifact [ID]` | ID 或 `--loom` 加 `--stage`；`--output FILE`，可选 `--overwrite` |
| `record ID` | 读取 Record 详情 |
| `config show` | 安全配置及 revision |
| `config set` | 必须 `--file FILE --revision HASH`；完整替换 |
| `config codex` | 预览 Codex 配置计划 |
| `mcp init` | `--ide codex`，可选 `--plan` |
| `mcp serve` | stdio 代理；可选 `--ide codex`；连接已有 Service |
| `logs [RUN]` | 可选 `--service`、`--follow`；文本或 JSON Lines |
| `mirror list` / `mirror inspect ID` | 列出边界或检查原始镜像 |
| `mirror restore ID` | 必须 `--to PROJECT`；`--scope step\|stage\|loom`，默认 loom；可选 `--dry-run` |
| `mirror export TRACE` | 必须 `--to NEW-DIRECTORY` |
| `resume RUN` | 可选 `--scope`、`--revision`；`--abandon-mirror` 要求 loom 范围 |
| `tui` | 常驻 TUI，也是无子命令入口 |

## 写入身份与输出

`run`、`answer`、`resume` 明确重放时同时接受 `--instance` 与 `--operation-id`，必须保留原参数。Resume 还绑定观察到的 Run revision。

普通 JSON 为 `{ ok: true, data, meta }` 或 `{ ok: false, error, outcome, meta, data? }`。错误 outcome 为 `not_applied`、`applied`、`unknown`。Meta 保留已知请求、项目、实例、操作和 Run 身份。回执状态与 Run 状态独立。

流式输出使用 JSON Lines，非 JSON 输出为可读文本。查询默认页大小 50。导出在本地写入 JSON，除非明确覆盖，否则独占创建文件。

参见 [CMD 指南](../usage/cmd.md)、[Run 操作](../usage/runs.md)和[镜像](../usage/mirrors.md)。

## e2e

```sh
intloom build ./my-loom
intloom e2e ./my-loom --list
intloom e2e ./my-loom --case S01 --root /absolute/e2e-results
intloom e2e ./my-loom --case M01 --entry mcp --root /absolute/e2e-results
```

读取本地 Loom 项目的 `e2e/` 案例，测试已有 `dist`。省略路径使用当前目录，默认 CMD；不会触发构建，也不从注册表发现案例。`--profile` 指定 YAML/JSON 模型配置，凭据使用环境变量引用。案例使用有序 `rounds`、SDK 的 `input` 和用户知识；模拟用户回答真实问题，独立 MCP Worker 执行宿主任务。每轮 Run 完成并结算后执行 Loom 自有检查。报告、实际 Run ID 和证据保存在 `--root`，失败不会自动修复或重放。`--seed` 只复现案例选择。`--list` 不要求模型或构建产物。

进度写入 stderr，最终摘要以 JSON 写入 stdout。退出码：0 通过、1 失败、2 阻塞、130 中断。没有案例检查时明确报告 `not_configured`，不代表业务验收通过。

## Kernel 操作身份与恢复查询

`run`、`answer`、`resume`、`cancel` 和 `pause` 均支持 `--instance` 与 `--operation-id`。相同身份只能重试完全相同的请求。`pause RUN` 请求在当前 Step 收敛后暂停。

操作回执为 `pending`、`accepted`、`rejected` 或 `indeterminate`；最后一种表示可能已经生效，需要先查询。回执保留整个 Service 实例生命周期。`operation UUID --instance OLD` 区分 `found`、`not_found`、`instance_changed`。换实例后不重放旧操作。

`runs` 包含保留的终态历史。通过 `runs --operation-id UUID --origin-instance OLD` 查找原操作创建的 Run，包括重启后的历史。Agent 完成接口返回提交回执；随后另行查询 Run。
