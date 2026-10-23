---
title: TUI 工作台
---

# TUI 工作台

TUI 面向当前项目的 Workflow 执行、Run 控制及资源查看。进入有效项目时复用 Service，确认已停止时自动启动；非项目目录提示使用 CMD 的 `intloom init`。一个未完成 Run 自动打开；多个未完成 Run 打开选择弹窗。没有未完成 Run 时显示 Logo、意图输入框和 Workflow 选择。

## 窗口与命令

Tab 循环切换 **Run → Logs → Assets**。Ctrl+O 搜索切换 Run，并保留当前窗口；Ctrl+P 为新 Run 选择 Workflow，返回意图草稿。切换窗口保留回答草稿、资源筛选及日志位置。Workflow 选择作用于新 Run 草稿。

输入 `/` 立即显示六项 MVP 命令：`/run`、`/loom`、`/runs`、`/resume`、`/stop`、`/quit`。继续输入筛选，方向键选择、Enter 执行、Esc 关闭。不可用命令仍显示并说明原因，普通文本中间的 `/` 保持文本。

## 回答与执行控制

Run 窗口显示执行日志、阶段/步骤、问题或确认，以及右侧状态；窄终端使用紧凑状态。Enter 提交意图或自定义回答，Shift+Enter 换行，长文本自动折行。选择问题选项或输入文本，审核完整回答集后发送。Esc 返回上一问题或确认选择，保留草稿；反馈继续同一个 Run。

`/stop` 先确认目标，再停止未完成 Run。沿用现有 `failed/RUN_STOPPED` 合同，界面显示 cancelled，已提交资源保留。`/resume` 支持当前范围或显式 Step/Stage/Workflow 范围；已完成范围需要重新选择，边界不允许的选项置灰。镜像捕获失败可重试或明确放弃此 Run 后续捕获。

pending/unknown 写操作保留原操作和 Service 身份，阻止再次提交；选择就地的 **Inspect original operation** 查询原回执/Run。断线后选择 **Inspect and reconnect**，确认已停止时才启动 Service。`/quit` 关闭客户端，后台执行继续。

## 日志与 Assets

Tab 到 Logs 后使用方向键、PageUp/PageDown 滚动，Home 返回开头，End 返回最新条目并恢复跟随。保留最近 200 条日志并标注省略数量；更早的持久化日志可通过 CMD 查看。

Assets 默认显示选中 Run 的真实提交引用，未选 Run 时显示项目资源。列表中按左方向键打开局部操作：切换 Artifact/Record、项目/Run 范围、筛选、刷新；右方向键返回列表。筛选使用上下方向键切换 Workflow/Stage/文本字段，Enter 应用。Workflow/Stage 精确匹配，文本筛选已加载 ID/元数据。项目列表每页 50 条，提供加载下一页操作。

Enter 查看 JSON，方向键/PageUp/PageDown 滚动，Esc 返回。旧 Artifact revision 不可用时显示 `historical_revision_unavailable`。资源查看不推进 Run 或修改文件。

活动动画只表示正在连接、提交或执行；切换边框短暂渐变。执行耗时与人工等待分开，未知 token/费用不等于零；Run 列表和统计属于当前 Service 实例。

初始化、配置、包管理、诊断、MCP 设置与镜像管理仍通过 CMD 完成。参见[快捷键与命令](../reference/tui.md)、[Run 语义](./runs.md)和[结果](./results.md)。
