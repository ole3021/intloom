---
title: CLI 参考
description: 命令、全局选项、离线行为和输出约定。
---

# CLI 参考

语法：`intloom [global options] <command>`。使用 `intloom --help` 或 `intloom <command> --help` 查看已安装版本的帮助。

## 全局选项

| 选项 | 行为 |
| --- | --- |
| `--project <directory>` | 精确选择项目根目录，否则从当前目录寻找项目 |
| `--json` | 输出结构化结果，不进行交互式提问 |
| `--no-interactive` | 禁用终端提问 |
| `--no-color` | 禁用颜色 |
| `--info` | 显示 info 及以上级别的服务日志 |
| `--debug` | 显示 debug 及以上级别，优先于 info |
| `--version` | 输出 CLI 版本 |

## 项目与服务

| 命令 | 选项与行为 |
| --- | --- |
| `init [directory]` | 目标必须新建或为空；可重复 `--workflow <package-or-tgz>` 安装包。位置参数目录与显式 `--project` 互斥。不启动服务。 |
| `start` | 启动或复用项目服务。`--port <n>` 指定端口。存储后端由 YAML 的 `localStorage` 选择。 |
| `stop` | 停止观察到的服务实例。正常离线状态幂等成功；不安全或过期资源可能导致失败。 |
| `status` | 报告服务状态和 Run 数量，区分离线、需要恢复和被阻止的状态。 |
| `doctor` | 检查诊断；`--execution cli\|studio\|agent_ide` 选择就绪检查入口，默认 `cli`。 |
| `recover` | 所有者退出后清理符合条件的过期资源；`--dry-run` 只预览。 |
| `config codex` | 输出项目连接配置，不修改 IDE 文件。 |

## 已安装包与已加载 Workflows

| 命令 | 行为 |
| --- | --- |
| `workflow add <package-or-tgz>` | 服务停止时安装到 `intloom.yaml` 项目 |
| `workflow remove <package>` | 移除声明，保留正式结果 |
| `workflow list` | 离线检查声明和安装完整性 |
| `flows` | 从运行中的服务查询已加载名称、加载诊断和 CLI 就绪状态 |

包名不一定等于执行名称 `flowName`。当前没有更新命令；替换包时依次停止、移除、添加和重启。

## Runs

| 命令 | 选项与行为 |
| --- | --- |
| `flow [flowName]` | 创建 Run。通过 `--intent <text>` 或 `--intent-file <file>` 提供意图；`-` 从 stdin 读取。交互模式可以询问缺失的值。 |
| `runs` | 列出当前服务的 Runs，可选 `--flow <flowName>` |
| `attach <runId>` | 查看并回答已有 Run |
| `cancel <runId>` | 明确停止该 Run，重复取消不改变终止状态 |

## 结果

| 命令 | 选项与行为 |
| --- | --- |
| `record <recordId>` | 读取一个不可变 Record |
| `artifacts` | 列出元数据。支持 `--flow`、`--stage`、`--limit`（1–200，默认 50）、`--cursor` |
| `artifact [artifactId]` | 按 ID 读取，或同时用 `--flow` 和 `--stage` 读取；两种选择方式不能混用 |
| `artifact … --output <file>` | 将完整对象导出到本地；父目录必须存在，覆盖已有文件需 `--overwrite` |

结果查询需要服务运行。Artifact 列表不包含业务数据，详情查询包含业务数据。

## 日志

`logs [runId]` 接受 `--service`、`--follow` 和全局日志及 JSON 选项。Run ID 与 `--service` 互斥。日志可离线读取，跟踪会观察已保存文件和重启，无需连接服务。

## 输出与退出状态

非交互 `flow` 要求 Workflow 名称和非空意图。等待中的 Run 正常返回；退出码 0 不能证明完成。失败或停止的 `flow`、`attach` 返回非零。成功的查询和取消返回 0。

常见 JSON 外层结构为 `{ run }`、`{ artifact }`、`{ artifacts: { data, nextCursor? } }` 和 `{ record }`。初始化返回 `{ projectRoot, status: "scaffolded" }`；停止返回 `{ projectRoot, stopped }`。缺失详情可以为 `null`。业务错误提供包含 `code`、`message` 和 `retryable` 的分类错误。

业务 JSON 输出到 stdout，进度输出到 stderr。`logs --json` 是例外，它有意将日志 JSONL 流式输出到 stdout。自动化应检查返回状态和字段，不要解析带颜色的展示文本。
