---
title: 问题、确认与反馈
---

# 问题、确认与反馈

Intent 通过人工交互消除不确定性，并确认需求与设计。

## 回答问题

阅读每个问题及上下文。选项是便捷建议，也允许自由文本。每个问题有一个文本回答，或一次明确且允许的跳过。跳过后仍存在的不确定性由业务规则评估。

CMD 使用实际 question ID 和当前 action ID。TUI 发送前审核完整回答数组。MCP 客户端优先呈现原生表单，否则收集真实回答并调用 `answer_ask`。

## 确认一个版本

确认针对当前展示的累计 Specification 或 Solution 及其匹配上下文。内容符合你的决定时接受；范围、设计、检查或假设需要修改时，拒绝并提供可执行反馈。

```json
{"isConfirmed": false, "feedback": "Add offline behavior to the acceptance criteria."}
```

反馈修改当前草稿，不创建另一个 Run。新的待处理操作产生新的 ID；旧 ID 无法批准后续版本。

## 职责边界

Agent 可以提出问题或吸收反馈，但不能填入真实用户回答、自行确认，或代替 Code 保存正式结果。

关闭表单保留等待操作。取消 Run 需要明确执行，且不回滚已提交数据。命令格式见 [Run 操作](../usage/runs.md)；停止等待中的 Service 前先阅读[恢复](../usage/recovery.md)。
