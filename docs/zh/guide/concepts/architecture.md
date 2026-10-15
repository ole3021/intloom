---
title: Service 与 Kernel 架构
---

# Service 与 Kernel 架构

IntLoom 将项目执行与用户界面分开。

| 层 | 职责 |
| --- | --- |
| CMD / TUI / MCP 代理 | 输入、呈现、观察和明确操作 |
| CLI Core | 共用客户端操作、本地设置和安全结果封装 |
| 项目 Service | 独立进程、发现、配置、API 与资源生命周期 |
| Kernel Core / Workflow 加载器 | 初始化项目，加载并注册编译定义 |
| Runtime | Run 状态、调度、路由、等待、所有权与恢复 |
| Effector | 分派 Code/Agent 调用，绑定当前能力 |
| Storage | 正式 Artifact/Record 持久化 |

Service 使用随 CLI 打包的私有 Kernel，管理每个项目的一套 Runtime/Storage 环境。客户端连接该环境，不执行自己的副本。

## 一次执行过程

请求解析项目 Service，验证入口策略与前提，接收 Run，初始化 Stage State，分派 Step，验证 outcome 并推进路由。人工交互发布等待；回答继续原调用或受支持恢复入口。正式结果由 Code 明确提交。

JSON 操作、快照 SSE 和 MCP 是共用项目操作的 Service 适配器。快照流显示当前状态，可以合并中间变化，不是审计历史。

## 公开开发边界

通过 `@intloom/loom-sdk` 编写 Workflow，通过 `@intloom/compiler` 构建。Kernel 内部私有，不是需要单独安装的公开依赖。

参见[执行资源](./execution.md)、[生命周期](./lifecycle.md)和 [ProjectClient](../reference/project-client.md)。
