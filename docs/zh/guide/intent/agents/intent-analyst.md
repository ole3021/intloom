---
title: Intent Analyst：需求分析
---

# Intent Analyst：需求分析

`intent-analyst` 是 Specification 阶段的 Agent，使用 `reasoning` 模型角色或外部 MCP 任务执行环境。

## 输入与职责

读取原始意图、当前 Specification 草稿、基线和反馈。按对象编辑本轮需求变更，检查一致性，并识别未解决问题。声明的三个 Skill 分别负责需求分析、澄清和审核。

## Tools 与输出

`readSpecification` 读取上下文，`editSpecification` 校验并保存本次修改的对象，`submitSpecification` 提交新问题或结束分析。最终 Step 结果为 `clarification_required` 或 `ready`，之后由 Code 控制提问、检查与确认。

编辑 Schema 不包含系统历史字段；工具维护累计变更，并拒绝基于过期草稿版本的修改。真实答案、跳过决策、确认和正式持久化由 Code 管理。

## 如何与该角色协作

提供具体目标、影响应用、场景和验收条件。在确认之前，通过反馈补齐或纠正需求。参见 [Specification 行为](../stages.md)和[人工交互](../interaction.md)。

草稿版本标识由 Schema 校验；过期提交返回当前版本，不消耗业务提案次数。
