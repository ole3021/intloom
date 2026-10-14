---
title: Solution Designer：方案设计
---

# Solution Designer：方案设计

`solution-designer` 是 Solution 阶段的 Agent，使用 `reasoning` 角色或外部任务执行环境。

## 输入与职责

读取固定的已确认 Specification、当前设计基线、项目上下文和人工反馈。提出架构、概念、场景、决策、风险，以及可执行验证命令计划。

## Tools 与输出

`readSolutionContext` 读取草稿，`editSolution` 保存本次修改的对象，`submitSolution` 提交新问题或结束设计并附带检查计划；`listProject`、`readProject` 检查实际文件。该角色没有项目写入或删除 Tool。

最终 outcome 为 `clarification_required` 或 `ready`。Code 检查提案、收集回答、取得设计确认并保存正式 Solution。

## 如何审核设计

检查需求可追溯性、检查命令能否执行、技术假设、影响范围和风险。不符合意图时，在确认前通过反馈要求修改。参见[完整示例](../walkthrough.md)。

草稿版本标识由 Schema 校验；过期提交返回当前版本，不消耗业务提案次数。
