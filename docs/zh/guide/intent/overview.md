---
title: Intent Workflow
---

# Intent Workflow

`@intloom/workflow-intent` 是 IntLoom 的软件开发 Workflow，在同一个 Run ID 下经过 **Specification → Solution → Implementation → Validation**。

## 各阶段的工作

| 阶段 | 工作 | 正式结果 |
| --- | --- | --- |
| Specification | 澄清需求并取得确认 | Specification Artifact 和 Record |
| Solution | 根据已确认需求设计并约定检查 | Solution Artifact 和 Record |
| Implementation | 修改文件并通过宿主执行的检查 | Implementation Record |
| Validation | 独立评估交付并重复检查 | Validation Artifact |

需求和设计通过人工确认后才进入实施。反馈修改当前草稿，继续同一个 Run。

## 开始使用

按 [Workflow 设置](../start/workflow.md)安装包，再选择 [CMD](../start/cmd.md)、[TUI](../start/tui.md) 或 [MCP](../start/mcp.md)。首次确认设计前建议阅读[完整示例](./walkthrough.md)。

Intent 在同一个宿主中活跃时独占，包括等待期间。失败或取消后保留之前的提交与项目修改。`completed` 表示已保存 Validation 报告；交付判断需要阅读报告。

参见[阶段详解](./stages.md)、[人工交互](./interaction.md)和[结果解读](./results.md)。内部 Agent 页面介绍各角色，外部客户端设置位于 [MCP 使用](../usage/mcp.md)。
