---
title: Intent 四阶段
---

# Intent 四阶段

## Specification

`prepare → analyze → check_scope → draft → check → confirm → commit`

同一个 Agent 在不同 Step 中分别分析和起草。分析读取 prompt、既有需求、真实代码和历史报告，区分事实与假设。草稿以“功能 → 需求 → 验收条件”为核心，Domain 可选。批量编辑 Tool 接收可编辑对象，Code 分配正式 ID。

Code 检查引用、范围与覆盖。缺失信息经 `resolve` 获取真实回答。确认时展示完整提案、变化、本轮工作及完成条件。提交保存完整需求快照与本轮 Record；`roundCriteria` 只保存在 Record。

## Solution

`prepare → analyze → check_analysis → design → check → confirm → commit`

读取本 Run 的 Specification Record。先分析实际系统，再定义受影响设计对象、约束、有依赖顺序的实施安排和验证计划；执行阶段为 `implementation`、`validation` 或 `both`。

Coverage 连接工作项、目标、实施项与验证项。分析问题返回 analyze，设计或覆盖问题返回 design。真实确认后提交完整方案 Record 和设计 Artifact。

## Implementation

`prepare → implement → verify → observe（需要时）→ check → resolve（需要时）→ commit`

读取固定方案和实际文件，在读取后修改。Code 记录真实操作、净变化和候选摘要；每个实施项必须说明已实施、复用或未完成。

命令由 Code 执行，过程性验证依靠实际观察和来源。修复限制在确认范围内。同候选重试须有新诊断证据或用户提供的条件变化；未结算命令不自动重放。部分交接必须得到绑定候选版本的明确选择。最终只保存 Implementation Record，不另设 Artifact。

## Validation

`prepare → verify → observe（需要时）→ assess → check → resolve（需要时）→ commit`

读取交付候选和全部本轮目标。可采用适用的 implementation-only 证据；validation/both 的工作独立执行。Agent 提出补充取证请求、提交实际观察、逐目标判断并明确复核历史问题。

Code 检查证据适用性、覆盖完整性和真实取证决定。`resolve` 针对展示的缺口提供继续、暂停或结束取证。失败或证据不足的有效报告可以提交；候选漂移、原执行未结算则阻断发布。Record 与累计 Artifact 原子提交。
