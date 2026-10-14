---
title: Run 生命周期与执行边界
---

# Run 生命周期与执行边界

Run 被接收时固定原始意图和执行策略，Runtime 根据声明拓扑推进游标。

| 状态 | 含义 |
| --- | --- |
| `running` | 执行可以推进 |
| `waiting` | 人工操作、外部 Agent 任务或其他明确等待 |
| `paused` | 受控镜像或范围执行需要明确继续 |
| `completed` | Workflow 到达声明终点 |
| `failed` | 执行因分类错误结束 |

接收回执 `pending`、`accepted`、`rejected` 属于操作状态，不是 Run 状态。成功的客户端查询可以描述失败执行。

## 所有权与取消

每次调用有独立范围、信号和能力。当前 action ID 将回答绑定到等待调用。取消或流转后的迟到结果不能覆盖新执行。

取消设置 `failed/RUN_STOPPED` 并向当前任务发送信号。已知迟到用量或提交引用可以在 `settled` 之前到达，但不会恢复 Run。取消不撤销已完成副作用。

## 重启与观察

Run 列表和统计属于当前 Service 实例。受支持的业务检查点可在新实例恢复，统计和预算重新开始；它们不提供跨重启的终态历史。

人工等待暂停执行时长预算。模型和 Tool 用量记录已知信息，外部推理未知值与零不同。

参见 [Run 操作](../usage/runs.md)、[恢复](../usage/recovery.md)和[配置限制](../reference/configuration.md)。
