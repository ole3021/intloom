---
title: 核心概念
description: 项目、Workflows、Runs、阶段、执行能力和正式结果。
---

# 核心概念

项目托管已安装的 Workflows。调用 `flow` 根据 `flowName` 选择 Workflow，并用新的 `runId` 创建一个 Run。Runtime 进入首个 Stage，初始化业务 State，执行 Steps，并根据返回的结果继续路由。

```text
Project service
  → installed Workflow / Blueprint
    → Run
      → Stage → Step → outcome → next Step or Stage
        → waiting for an Agent task or a human action
        → completed or failed
```

## 定义与执行

| 术语 | 含义 |
| --- | --- |
| Workflow 包 | 包含可执行资源的可安装 ESM 包 |
| Blueprint | 编译后的拓扑，定义入口 Stage、Steps 和结果路由 |
| Stage | 有独立 Schema 和初始化 State 的流程阶段 |
| Step | 一次 Code 或 Agent 执行 |
| Run | 带有原始意图、身份、状态和游标的一次执行 |
| Cursor | 当前 `{ stageName, stepName }` 位置 |

包名、`flowName` 和 `runId` 标识不同对象。用 `workflow list` 查看已安装包声明，用 `flows` 查看已加载 Workflows，用 `runs` 查看当前服务中的执行。

## Code、Agents 与人

**Code** 执行确定性操作，可以读写 Stage State、提交正式数据，并向用户提问或请求确认。

**Agents** 在 Step 中推理。声明的 Tools 在服务内执行，可以访问 Stage State 和只读正式 Storage。Agent 不能直接提交正式结果，也不能使用 Code 的交互 API。使用 Tools 后，它返回一个 outcome。

**人** 回答明确的待处理操作。模型的最终回复不是人工确认。服务将答案匹配到原来的 Run 和操作。

每个 Step 只返回 `{ outcome: "..." }`。业务值通过 Stage State 和已提交数据传递，不通过任意 Step 结果字段传递。见[阶段与路由](./development/stages.md)。

## 三种不同的数据

| 数据 | 所有者与生命周期 |
| --- | --- |
| Run 控制状态 | Runtime 管理的状态、游标及待处理操作或任务 |
| Stage State | 当前 Stage 经过 Schema 验证的业务草稿，离开 Stage 时释放 |
| Artifacts 和 Records | 明确提交的正式数据，在服务重启后仍保留 |

Artifact 是某个 Workflow/Stage 的当前结果，其 revision 用于冲突检测。Record 是不可变存储条目，ID 由 Workflow Code 决定，不应假设与 Run ID 相同。Artifact revision 不提供历史版本查询。

恢复检查点保留特定执行边界，供后续服务启动时恢复。它们与正式 Storage 分开，并不让所有中断操作都可重启。

## 执行方式

CLI 使用项目的服务模型配置。外部 MCP 客户端在默认 `useMcpAgent: true` 时使用客户端 Agent 任务；设为 `false` 时使用服务模型。仅凭传输协议不能判断执行器，CLI 也通过内部 MCP 端点与服务通信。

## 完成与失败

`completed` 表示 Workflow 到达配置的结束位置。工作流可以保存一份包含未完成或失败检查的报告，同时结束自己的流程。需要检查实际输出，判断业务目标是否达成。

失败或取消的 Run 可能已经提交数据或修改文件。取消撤销后续执行权限，不撤销先前的影响。开始替代任务前，请阅读[结果](./usage/results.md)和[恢复](./usage/recovery.md)。

