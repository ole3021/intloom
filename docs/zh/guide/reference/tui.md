---
title: TUI 快捷键与输入
---

# TUI 快捷键与输入

输入框首字符为 `/` 时立即打开命令列表，继续输入筛选，方向键选择、Enter 执行、Esc 关闭。文本中间的 `/` 保持普通文本。问题选项、Logs 和 Assets 中也可输入 `/`。全部六项命令均列出；不可用项置灰并说明原因。

| 按键 | 操作 |
| --- | --- |
| Tab | Run → Logs → Assets → Run 循环切换；弹窗打开时不切换窗口 |
| Ctrl+O | 搜索、切换当前 Service 的 Run，保留当前窗口 |
| Ctrl+P | 为新 Run 选择 Workflow |
| Enter | 提交意图/自定义回答、选择选项或执行菜单项 |
| Shift+Enter | 输入区换行；长文本自动折行 |
| Esc | 关闭弹窗、返回上一问题/确认选择，或返回资源上一层 |
| 方向键、PageUp/PageDown | 在 Logs 或资源内容中滚动 |
| Home / End | 在 Logs 中返回开头/最新位置 |

Shift+Enter 需要终端报告修饰键（Kitty 键盘协议）；输入区保留 Ctrl+J 换行兼容方式。其他旧的 Ctrl 全局操作已移除。回答集在完整审核后发送。

| MVP 命令 | 操作 |
| --- | --- |
| `/run [loom]` | 新建意图草稿；提交意图后创建 Run |
| `/loom` | 为新 Run 选择 Workflow，与 Ctrl+P 相同 |
| `/runs` | 切换 Run，与 Ctrl+O 相同 |
| `/resume` | 按现有范围和边界规则继续 paused Run |
| `/stop` | 确认停止选中的未完成 Run，保留已提交资源 |
| `/quit` | 关闭 TUI，Service 与 Run 继续执行 |

窗口导航、日志、筛选和资源查看不再占用 slash 命令。Assets 列表中按左方向键打开局部操作，选择 Artifact/Record、项目/Run 范围、筛选或刷新；右方向键返回列表。筛选使用上下方向键切换字段，Enter 应用。

pending/unknown 写操作通过就地的 **Inspect original operation** 选项查询原回执/Run，不重复提交。断线或 Service 停止时选择 **Inspect and reconnect**；仅在确认 Service 已停止时启动。

通过 `intloom` 或 `intloom tui` 启动。初始化、配置、包管理、MCP 设置与镜像管理使用 CMD。参见 [TUI 指南](../usage/tui.md)与 [Run 操作](../usage/runs.md)。
