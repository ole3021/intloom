---
title: Service 与 Kernel 架构
---

# Service 与 Kernel 架构

项目 Service 持有一个 Kernel 执行环境。CMD、TUI 和 MCP 连接这个环境，不各自保存一套 Run 或 Stage State。

| 模块 | 职责与状态归属 |
| --- | --- |
| Host | 项目配置、已加载资源、模型准备、进程与存储生命周期 |
| Operations | 可信入口策略、变更准入、当前实例的操作回执与查询 |
| Runtime | Run/Stage 状态、Call、路由、等待、暂停、取消和恢复 |
| Execution | Code/Agent/Tool 执行；外部 Agent 的任务、claim 和执行回执 |
| Access | 将 SDK 能力绑定到当前 Call 与 Tool，不复制业务状态 |
| Loom loader | 发现并校验已构建 Loom 包的资源 |
| Storage | 正式 Artifact/Record 的事务与查询 |
| Mirror | 不可变历史执行镜像与显式恢复 |
| Transport | HTTP/JSON、SSE、MCP 与人机交互适配 |

Host 准备固定执行策略，Operations 接受请求，Runtime 创建 Run 并推进 Step，Execution 执行 Code/Agent，Access 检查每次能力使用的权限与有效期。Host 只向 Operations 提供所需端口；修改 Run 统一经过带操作回执的 `admit`，等待结果是独立的观察操作。只有 Runtime 决定下一步路由；Execution 和 Access 不依赖 Runtime 的实现。

操作接受与执行完成是两件事：操作回执说明准入结果，Run 快照说明当前进展。观察连接断开不取消执行，也不重放请求。人类等待先保存问题，再对外发布；先保存已接受回答，再继续执行。Agent 等待只持久化恢复边界，进程内 claim 无法跨重启恢复。

实际提交引用和未完成活动独立于可选的模型统计。Run 已停止时，先前接受的外部操作仍可能尚未结束，此时 `settled` 为 `false`。独占 Run 在这些活动结束前仍占用项目，暂停状态也保留占用。服务关闭后，新操作在修改状态前被拒绝，已有回执仍可在该实例中查询。终态检查点保留为只读历史；结果不确定的外部副作用不会自动重放。

模型适配保留 Tool 的能力绑定；Tool 返回后不能继续写入 State。委派 Tool 的回执包含执行后的检查结果，同一请求重试保持相同的成功或失败结果。恢复校验由 Runtime 提供独立入口，Host 的离线镜像恢复不需要构造执行器。

开发 Loom 使用 `@intloom/loom-sdk` 与 `intloom build`。Kernel 保持私有并随 CLI 打包。具体状态归属、依赖方向和恢复约束见 [Kernel 契约](https://github.com/ole3021/intloom/blob/main/packages/kernel/README.md)。

另见[执行资源](./execution.md)、[生命周期](./lifecycle.md)、[恢复](../usage/recovery.md)和 [ProjectClient](../reference/project-client.md)。
