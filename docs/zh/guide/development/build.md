---
title: 构建、测试、安装与分发
---

# 构建、测试、安装与分发

在 Workflow 源码包中编译，再打包生成产物：

```sh
bun install
bun run build
npm pack --ignore-scripts
```

Compiler 生成 ESM、声明、source map 和声明的 Skill 附件。作者清单需要导出生成入口及 `./package.json`，并在 `files` 包含 `dist`。SDK 和其他运行时导入放在 dependencies 或 peers，Compiler 放在开发依赖。

## 验证包

测试 Schema、Code 和 Tools，再把归档安装到干净项目。确认不访问作者源文件也能加载导出定义和 Skill 附件，执行预期路由、人工交互、持久化与恢复边界。

对于 [capture](./create.md)，使用真实归档路径：

```sh
intloom init capture-project --workflow /absolute/path/capture-workflow-0.1.0.tgz
cd capture-project
intloom start
intloom flows
```

先准备 CMD 模型配置或外部 MCP 客户端，再携带意图运行 `capture`。预期产生 completed Run 和一个以 Run ID 为 ID 的 Record。Service 重启后读取该 Record，检查持久化。

## 分发与升级

`npm pack` 创建本地归档，发布属于单独明确操作。发布前核验运行时依赖对消费者可用，并测试真实归档布局。

当前产物协议为 `2026-10-08`，与 npm 包版本独立。为未完成 Run 保留兼容资源；替换包前停止 Service，重启后加载新代码。

编译和受控测试不能证明真实模型质量或客户端接受。参见 [Compiler 参考](../reference/compiler.md)和[兼容性](../reference/compatibility.md)。
