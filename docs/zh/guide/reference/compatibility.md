---
title: 版本与兼容性
---

# 版本与兼容性

## 运行时与包边界

IntLoom 包要求 Node.js 26.4.0+，仓库开发使用 Bun 1.4.0+。TUI 启动器启用实验性 FFI。安装后的客户端配置绑定可执行路径，路径改变后应重新生成。

CLI、轻量入口包和打包的私有 Kernel 构成协调发布单元。Workflow 包有独立 npm 版本。

## Workflow 产物协议

当前协议为 **2026-10-08**，在 `package.json.intloom.version` 声明，由 Compiler 和宿主检查，与 npm 版本独立。

编译 Workflow 必须导出 blueprint/codes/agentSpecs，包含有效 Stage 初始化器及兼容资源。源文件或 Schema 改变后需要重建并重新安装。替换包前停止 Service，重启后采用新安装。

为未完成检查点保留兼容 Workflow 资源。不兼容 State 或拓扑不会自动迁移。

## 执行兼容性

提供方协议、端点可用性、Tool 支持、结构化输出和输出预算影响真实执行。YAML 有效或 doctor 成功不证明真实模型调用。

Codex 提供专用具名适配器。其他客户端需要完整外部 Agent 任务协议和人工交互，并验证实际行为，包括回退呈现和重连。

本地归档验证不证明公共注册表可用性。交付判断需要阅读实际 Validation 报告，不能从版本号推导。

参见[配置](./configuration.md)、[恢复](../usage/recovery.md)和[包管理](../usage/packages.md)。
