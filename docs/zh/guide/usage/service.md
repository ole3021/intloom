---
title: 管理项目 Service
---

# 管理项目 Service

每个项目拥有一个独立本地 Service 进程。CMD、TUI、MCP 发现并连接该进程，共享 Runtime 和 Storage。

```sh
intloom status
intloom start
intloom flows
intloom stop
```

`start` 创建 Service，或复用已核验的实例。`status` 区分 running、stopped、unavailable。`stop` 关闭新请求接收、挂起执行、等待已知任务、释放资源并核验停止结果。

## 有计划地重启

配置、凭据、CLI 或 Workflow 改变后需要重启。停止前先查看活跃 Run 及其恢复边界。正在进行的模型请求或不支持恢复的人工交互，无法在重启后自动重建。

关闭 TUI、MCP 连接、watch 流或 wait 命令不会停止执行。取消一个 Run 使用 `cancel`，停止项目进程使用 `stop`。

## 绑定特定实例

排查竞争时，保留观察到的 instance ID，并使用 `stop --instance INSTANCE`。针对旧实例的操作不应发送到替代进程。

过期锁和发现资源通过明确操作处理：

```sh
intloom recover --dry-run
intloom recover
```

清理前先阅读计划。`recover` 清理符合条件的过期资源，不重新执行 Workflow 业务逻辑。参见[恢复](./recovery.md)和[故障排查](../help/troubleshooting.md)。
