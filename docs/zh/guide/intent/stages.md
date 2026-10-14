---
title: Intent 的四个阶段
---

# Intent 的四个阶段

## Specification

[Intent Analyst](./agents/intent-analyst.md) 提出累计需求变更和未回答问题。Code 检查提案、向用户提问、准备确认，并保存已接受的 Artifact/Record。反馈返回分析。

## Solution

[Solution Designer](./agents/solution-designer.md) 使用固定的已确认 Specification、读取项目文件，提出设计变更和命令计划。Code 核验引用与检查，完成澄清和确认，保存 Solution Artifact/Record。

## Implementation

[Implementation Developer](./agents/implementation-developer.md) 根据已确认需求与设计修改项目文件。Code 对照声明与实际变更并执行约定命令。检查失败返回修复反馈，最终提交前重新核验快照，保存 Implementation Record。

## Validation

[Validation Analyst](./agents/validation-analyst.md) 读取固定依据和交付证据，提出目标评估与发现。宿主 Code 管理重复检查、报告一致性和计算统计，最后保存 Validation Artifact。

## 共同规则

Agent 提出业务内容，Code 管理真实人工回答、确认、命令证据和正式持久化。Stage State 与正式输出分别管理。

正常阶段路线是线性的，但阶段内部存在反馈和检查循环。Specification 等待具备恢复入口，Solution 等待当前依赖原调用存活。参见[交互](./interaction.md)和[恢复](../usage/recovery.md)。
