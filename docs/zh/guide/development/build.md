---
title: 构建、测试与分发
description: 编译包资源，验证安装后的产物，并分发 Workflow 归档文件。
---

# 构建、测试与分发

将 `@intloom/compiler` 用作开发依赖，将 `@intloom/workflow-sdk` 用作运行时依赖。服务加载编译后的资源，不会在执行 Workflow 时运行 Compiler。

## 构建输出

[创建 Workflow](./create.md)中的构建脚本调用 `compileWorkflow({ packageRoot })`。编译过程读取 `workflow.yaml`，跟踪资源引用，验证拓扑和声明，生成 JavaScript 与类型声明，包含 Skill 资源，并在替换 `dist` 前验证包边界。

生成的入口准确导出 `blueprint`、`codes` 和 `agentSpecs`。生成的标识符应保持为内部细节，它们可能在重新构建时变化。Compiler 不会执行业务模块来发现导出，也不会在构建时运行初始化器。已安装模块在运行时导入，因此应避免顶层业务副作用。

默认构建配置为 `tsconfig.build.json`。通过 `tsconfigFile` 可以选择包根目录内的其他配置。运行时导入必须是内置模块或已声明的包依赖。Compiler 会从生产输出中排除源码旁的 `.spec.ts`、`.intg.ts` 和 `test/`。

## 验证你的 Workflow

验证编写的 Code、Schema 和 Tool，再将编译归档安装到干净项目中，通过目标服务检查其实际行为。在无法访问编写源码的环境中验证公开导出、声明和 Skill 资源。生产输出应排除测试文件。

受控模型响应可以使执行检查可重复，真实模型质量和目标 MCP 客户端仍需单独验收。编译成功本身不能证明这两项。

## 生成归档文件

对于编写指南中的根目录布局包，先构建，再从包目录执行打包：

```sh
bun run build
npm pack --ignore-scripts
```

这会创建本地归档，不会发布。归档应包含生成的 `dist`、包元数据、README 和许可证。编写的 manifest 必须将 `exports["."].types` 和 `default` 指向生成文件。测试文件不能进入归档。

Compiler 本身不会生成发布根目录 manifest，也不会发布到 npm。如果选择不同的分发根目录，应作为独立打包步骤编写并验证对应 manifest。不要直接复制内置包的私有构建脚本而不检查它对布局的假设。

## 安装到干净项目

在另一个目录中，使用真实归档路径：

```sh
intloom init capture-project --workflow /absolute/path/to/capture-workflow-0.1.0.tgz
cd capture-project
intloom start
intloom flows
```

确保 SDK 和其他运行时依赖可以解析。对于 `capture` 包，通过 [MCP 方式](../quickstart/mcp.md)运行 `capture`，或先配置 [CLI 服务模型方式](../quickstart/cli.md)。预期结果是 Run 完成，并产生一个以该包 Run ID 为 ID 的 Record：

```sh
intloom record <runId>
```

重启服务后读取 Record，以验证持久化。检查编译、安装和执行能否在无法访问编写源码目录的情况下工作。

## 发布与升级

包版本和 Workflow 协议版本不同。当前协议是 `2026-10-08`。先发布兼容依赖，再发布需要这些依赖的 Workflow；使用仓库链接完成本地安装，不能证明公共注册源中已存在相关包。

未完成的 Run 需要精确的原始资源。它们等待恢复时重新构建或升级包，可能使检查点失效。见[包管理](../usage/packages.md)。

