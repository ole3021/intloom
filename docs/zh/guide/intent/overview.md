---
title: Intent Loom
---

# Intent Loom

`@intloom/intent` 是 IntLoom 的功能开发 Loom，在同一个 Run 中完成 **Specification → Solution → Implementation → Validation**。

## 价值和目的

它主要解决软件开发中四类容易失去控制的问题：

- **意图不清楚**：一句需求中可能混有目标、假设、限制和未回答的问题，需要先澄清。
- **多轮迭代不一致**：新增功能后，需求、设计和代码容易各自变化，逐渐脱节。
- **变更缺少依据**：难以知道某段代码为什么存在、对应什么需求、这次修改影响了什么。
- **完成缺少证据**：代码写完、命令通过、需求满足和代码质量，需要分别判断。

因此，Intent 的核心价值包含两部分：**推进本轮开发，以及维护后续开发仍然能够理解和使用的项目事实。**

## 业务范围

Intent 负责添加、调整、移除和修复功能，包括所需模块、接口、数据与交付测试的变化。独立代码整理和结构重构由另一 Loom 承担；一个功能涉及多个模块不代表可以附带无关重构。

修复既有功能可以不改变正式需求，但仍须明确本轮工作和完成条件。开发规范与技术偏好通过 `prompt` 进入正式需求，不另外设置业务配置。

## 正式成果

| 阶段 | 正式产出 |
| --- | --- |
| Specification | 完整需求 Record + 当前需求 Artifact |
| Solution | 完整设计及计划 Record + 当前设计 Artifact |
| Implementation | 实际项目文件 + 固定候选版本 Record，无 Artifact |
| Validation | 本轮验收 Record + 累计验收 Artifact |

每阶段每 Run 正式提交一次。下游解析同 Run 的不可变 Record；已提交成果的实质变化开启新 Run。Validation 只验收交付候选，不修复产品。

需求和方案由用户真实确认。部分交付须另行明确选择，仍保留完整验收范围。报告完成可以得到 `passed`、`failed`、`partial` 或 `undone`，不等于全部验收通过。

安装已构建包或兼容归档后执行：

```sh
intloom loom add @intloom/intent
intloom run intent --prompt "开发一个任务管理应用"
```

继续阅读[阶段](./stages.md)、[用户交互](./interaction.md)、[结果](./results.md)、[示例流程](./walkthrough.md)和 [Loom 设计原则](../development/design-principles.md)。本轮重构尚未进行真实模型或连续两轮 E2E 验证。
