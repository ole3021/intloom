---
title: 通过 TUI 完成第一次运行
---

# 通过 TUI 完成第一次运行

先准备项目、安装 Intent Workflow，并按照 [CMD 设置](./cmd.md)配置服务模型。CMD 和 TUI 使用同一个服务执行环境。

```sh
intloom tui
```

不带子命令的 `intloom` 也会打开 TUI。请使用交互终端；启动器会自动启用渲染器需要的 Node 实验性 FFI 标志。

## 完成第一次流程

1. TUI 检查项目，复用已有 Service，确认已停止时自动启动。非项目目录提示使用 CMD 的 `intloom init`。
2. 没有未完成 Run 时，按 **Ctrl+P** 打开 Workflow 弹窗并选择 `intent`。未完成 Run 自动打开；输入 `/run` 新建草稿。
3. 输入意图，**Enter** 提交，**Shift+Enter** 换行，长文本自动折行。
4. 查看 Run 的阶段、步骤、活动和待处理交互。
5. 选择问题选项或输入文本，审核完整回答后提交。确认操作先阅读需求或设计，再接受或提供反馈。
6. 继续经过 Implementation 和 Validation，最后按 **Tab** 切换到 Assets 查看已提交的 Artifact/Record。

用 **Ctrl+O** 打开 Runs，重连后选择原 Run。输入 `/` 打开六项命令列表，使用 `/stop` 停止 Run、`/resume` 恢复 paused Run。`/quit` 关闭 TUI，Service 和 Run 保持运行；Escape 关闭弹窗或从资源页面返回。

已知 token 和费用估算反映服务可见的用量，不是供应商账单。Run 完成后仍需阅读 Validation 的发现。

参见 [TUI 操作指南](../usage/tui.md)和[快捷键参考](../reference/tui.md)。
