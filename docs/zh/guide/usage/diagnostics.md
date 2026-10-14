---
title: 日志与就绪检查
---

# 日志与就绪检查

先用诊断识别失败层，再决定是否修改模型、包或 Service。

```sh
intloom --version
intloom status --json
intloom doctor --execution cli --json
intloom flows --json
intloom attach RUN-example --json
intloom logs RUN-example --debug
intloom logs --service --follow
```

外部 Agent 执行使用 `doctor --execution agent_ide`。就绪检查读取本地前提，不调用真实模型。

## 阅读证据

Run 日志关联 Run、Stage、Step 和 execution ID。重复执行同一个 Step 会产生新的 execution ID；等待和回答属于同一次调用。Info 显示生命周期事件，debug 增加安全的路由和执行摘要。

Service 退出后仍可阅读日志。`--json` 提供结构化输出或 JSON Lines。`--info`/`--debug` 诊断使用 stderr，保持机器 stdout 可用。

结合 `lastError`、最后游标、待处理操作、operation 回执和真实已提交结果判断。传输失败可能留下仍在运行的 Run；模型失败属于 Run。

日志保存安全诊断，不保存业务 State 或恢复指令，不能重建缺失检查点。报告问题请阅读[收集诊断信息](../help/reporting.md)。
