---
title: 日志与诊断
description: 诊断配置、包加载、服务所有权和执行失败。
---

# 日志与诊断

首先判断问题发生在安装、服务启动、入口就绪检查，还是已有 Run 中。

```sh
intloom status
intloom doctor --execution cli
intloom workflow list
```

外部 MCP 使用 `doctor --execution agent_ide`。离线检查读取已保存的配置和安装完整性，不会导入 Workflow 代码或调用模型。在线检查向当前服务查询所选入口的就绪状态。

Doctor 可以成功结束，同时报告 `attention` 或 `not_checked`。请逐项检查文本或 JSON 中的结果。`available` 就绪状态不会验证远程模型的响应。

## 阅读已保存的日志

```sh
intloom logs <runId>
intloom logs <runId> --debug
intloom logs --service --follow --info
intloom logs --service --json --debug
```

日志可离线读取。`--follow` 观察重启后产生的新文件，不会启动服务。Run ID 与 `--service` 不能同时使用。按 Ctrl+C 停止跟踪。

需要在命令执行期间显示进度日志时，添加 `--info` 或 `--debug`。默认命令不显示服务日志。业务 JSON 保持输出到 stdout，进度输出到 stderr；显式 `logs --json` 将 JSONL 输出到 stdout。

每个服务实例保留一个 `.intloom/logs/LOG-<timestamp>.jsonl` 文件。日志包含标识符、事件、耗时、用量和分类错误，不包含原始意图、答案、提示词、原始 Tool 载荷或凭据。日志用于诊断，不是可恢复的执行状态。

## 常见情况

| 现象 | 下一步 |
| --- | --- |
| 没有 Workflow | 停止服务后安装包 |
| 包已安装，但没有可执行 Workflow | 阅读 `flows` 加载诊断，检查元数据、协议和生成的导出 |
| CLI 缺少模型配置 | 添加 `llms.default`，提供启动凭据并重启 |
| MCP 已就绪，但 CLI 未就绪 | 检查执行方式，两种入口对模型的要求不同 |
| 服务报告 `recovery_required` | 用 doctor 检查所有者，并参考[恢复](./recovery.md) |
| 服务报告 `blocked` | 处理未知或活跃的所有者、端口占用或无效元数据，不要强制删除锁 |
| Agent 等待看起来没有进展 | 检查 MCP 客户端是否领取并完成任务，连接本身不会自动唤醒任务 |
| 模型请求或结构化输出失败 | 检查 Run 错误和日志，核对端点、模型、Tool 支持和输出限制 |
| 请求超时 | 查询原来的 Run；超时不代表取消 |
| 服务检查只在另一台机器失败 | 检查服务继承的可执行程序版本和参数 |
| 保存数据后失败 | 创建替代任务前先读取 Records 和 Artifacts |

## 日志失败

日志写入失败会拒绝新任务，并在执行边界停止活跃执行。状态会报告 `logError`，`stop` 仍可使用。已经提交的操作会保留。清理会移除超过 14 天的已关闭文件，或移除文件以满足 1 GiB 目录容量预算；当前服务文件不会轮转。

错误类别见[错误参考](../reference/errors.md)，安全重启行为见[恢复](./recovery.md)。

