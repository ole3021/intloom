---
title: Validation Analyst：验证分析
---

# Validation Analyst：验证分析

`validation-analyst` 是 Validation 阶段的 Agent，使用 `review` 角色或外部任务执行环境。

## 输入与职责

读取固定 Specification/Solution 依据、Implementation Record、当前项目证据和宿主检查结果。通过可追溯发现评估需求满足、方案符合和实现质量。

## Tools 与输出

`readValidationContext` 与 `submitValidation` 管理报告提案，`listProject` 与 `readProject` 检查文件。该 Agent 没有项目写入或删除 Tool，返回 `ready`。

Code 管理重复命令检查、身份与证据一致性、报告统计计算。报告无效时，提交 Tool 提供一次有限修复机会，第二次无效提交失败。Agent 不能提供宿主管理的总数或提交计数。

## 如何阅读结论

检查每个评估目标、支持证据、不可用检查和未解决问题。报告提交后 Workflow 到达终点，即使仍有发现。参见[结果解读](../results.md)。

必查范围来自本轮需求和设计变更、实现来源及直接关联对象；首次交付或广泛变更采用全量范围。可通过 `readValidationDetails` 按需读取其他对象或完整命令输出，并在提交前用 `expandValidationScope` 附上影响原因扩展回归范围。删除或退役对象仍需检查清理结果，范围外的历史对象不计为本轮已验证。
