---
title: 构建、验证与分发
---

# 构建、验证与分发

使用开发者构建命令生成完整的 Loom 发布目录：

```sh
intloom build ./capture-loom
cd capture-loom/dist
npm pack --ignore-scripts
```

已在源包目录时可以直接运行 `intloom build`。必须打包 `dist`，其中的清单由 Compiler 生成；源包不需要自行维护生成入口的 exports。SDK 及输出 JS/声明引用的包应在 dependencies 或 peers 中，Compiler 和 CLI 属于开发依赖。

先检查 Schema、Code、Tool 和关键路由，再将实际归档安装到独立项目，检查声明、资源、交互、持久化及恢复行为。使用归档的实际路径：

```sh
intloom init capture-project -l /absolute/path/capture-loom-0.1.0.tgz
cd capture-project
intloom loom list
intloom run capture --prompt "Save this request"
intloom runs
```

执行前完成所选执行模式的项目配置；运行配置见 CLI 文档。`intloom loom` 面向已构建的包；`intloom build` 面向开发者源码。

当前 Loom 协议为 `2026-10-15`，独立于 npm 包版本。重复构建使用稳定的逻辑资源 ID，但恢复仍检查实际产物内容。保留未结束 Run 所需的包；不要在 Service 使用期间直接替换资源。

`npm pack` 只生成本地归档，发布需要单独操作。构建和受控测试不能证明真实模型效果或完整业务验收。错误、警告和中断处理见 [Compiler 参考](../reference/compiler.md)。
