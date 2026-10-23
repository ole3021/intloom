---
title: 理解 Intent 结果
---

# 理解 Intent 结果

## 四个 Record，三个 Artifact

**Record** 保存某次 Run 中一个阶段的不可变事实。**Artifact** 保存当前快照或累计视图。Stage State 是临时工作状态，不能作为正式交接。

| 结果 | 含义 |
| --- | --- |
| Specification Record | 完整需求、本轮工作、Coverage、roundCriteria、变化和真实确认 |
| Specification Artifact | 最新正式需求，不证明已实现 |
| Solution Record | 固定需求引用、完整设计、实施与验证计划、目标定义和确认 |
| Solution Artifact | 最新意图设计，不代表所有代码现状 |
| Implementation Record | 实际变化、操作来源、候选 manifest、验证回执及完整/部分交付 |
| Validation Record | 固定上游链、候选、完整目标判断、问题、证据和取证决定 |
| Validation Artifact | 有序 Record 索引、最新轮次、按定义版本区分的目标结果及历史问题更新 |

不设置 Implementation Artifact，也不设置脱离版本的全项目通过标记。文件摘要用于识别候选，不是备份，也不能证明正在运行的服务使用了该候选。

## 验收结论

每个目标为 `passed`、`failed` 或 `unverified`，Code 派生本轮汇总：

- `failed`：至少一个目标失败。
- `passed`：全部目标通过，空范围不能通过。
- `partial`：部分目标通过，其余尚未验证。
- `undone`：没有目标形成明确通过或失败判断。

Run 完成表示报告已保存。命令退出码只是待解释证据；部分交付和结束取证都不等于用户批准验收。

## 跨 Run 累积

未触及目标保留原候选与定义版本的历史结论。最新未知不回退到旧通过；定义变化产生独立索引。本轮专属条件只保存在 Record。

历史问题仅通过明确更新变成 `present`、`resolved`、`no_longer_applicable`、`unverified` 或 `invalidated`。后续未知可以保留最后一次确定判断作为历史，但不宣称它验证了新候选。遗漏不等于关闭问题。
