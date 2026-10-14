---
title: Code、Agent、Tool 与 Skill
---

# Code、Agent、Tool 与 Skill

Code 和 Agent Step 使用相同 outcome 路由，但承担不同职责。

| 资源 | 职责 |
| --- | --- |
| Code | 确定性业务规则、提问、确认与正式提交 |
| Agent | 在指令和输出 Schema 约束下推理 |
| Tool | 分配给 Agent Step 的类型化可调用能力 |
| Skill | 声明的指令内容及可选打包附件 |

## 能力边界

Code 获得 Stage State、可写 Storage、人工交互、取消信号和可选 Project 能力。Agent Tools 获得 State、只读 Storage、信号和可选 Project 能力，不能直接提交正式数据或调用人工交互。

Code 通常从 State 读取业务数据，并返回 `{ outcome: "..." }`。Agent 最终输出使用原 Zod Schema 解析；宿主也解析 Tool 输入输出并检查 JSON 兼容性。

## 执行环境

服务执行根据项目设置构建模型，外部 MCP 执行把声明任务交给已连接客户端，并管理认领所有权和串行 Tool 调用。两种方式由相同宿主验证能力与结果。

能力属于一次当前调用。所有操作应 await；不要把 access 保存在模块状态中，也不要在返回、取消或流转之后继续使用。

参见 [Code 与 Agent](../development/execution.md)和 [Tools 与 Skills](../development/tools-skills.md)。
