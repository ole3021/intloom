# IntLoom

[English](./README.md) | 简体中文

让人的意图，织成行动。

IntLoom 是一个本地工作流框架，将 Agents、代码执行和人的决策组织在同一个明确的流程中。它帮助一个意图经过推理、执行、提问和确认，并保留 Workflow 正式提交的结果。

## 为什么需要 IntLoom

当一项工作既需要 AI 推理，又涉及实际操作时，就需要清晰的执行过程。IntLoom 围绕三个目标构建：

- **明确方向：** Workflow 定义步骤、检查和决策节点，为工作提供执行路径。
- **人的参与：** 提问与确认让澄清、审查和修改成为流程的一部分。
- **保留成果：** 正式提交的结果与工作草稿分开保存，执行后仍可查询。

如果一项任务既需要灵活推理，也需要明确控制工作如何推进，就可以使用 IntLoom。

## 它如何工作

Workflow 定义一个流程，Run 是针对一个意图的一次执行。Agents 负责推理并使用业务 Tools，代码负责操作和检查，人负责回答问题并审查决策。后续执行继续沿用同一个 Run。

面向软件开发，[Intent Workflow（英文）](./packages/intent/README.md) 将过程组织为需求规格、方案设计、实现和验证四个阶段。其他 Workflow 可以定义自己的阶段与输出。

你可以通过 CLI，或通过 MCP 连接的 Agent IDE 使用 IntLoom。两种方式共用本地项目服务：CLI 使用项目配置的模型，默认 MCP 路径使用所连接客户端的 Agent 执行环境。保存的结果可以通过任一入口查询。

## 开始使用

发布包支持 Node.js 22.22.0+，推荐使用最新的 Node.js 24 LTS。开发本仓库需要 Node.js 24+、Bun 1.4.0+ 和 npm。以下使用源码版本；发布版本的使用前提和完整配置步骤见[安装指南](./docs/zh/guide/quickstart/installation.md)。

在仓库根目录构建 CLI，并查看帮助：

```sh
bun install
bun run build --filter=@intloom/cli --concurrency=1
node apps/cli/dist/bin.js --help
```

准备一个兼容的已编译 Workflow 归档，并确保其运行时依赖可以解析。将下面的归档路径替换为实际文件。项目目录必须新建或为空；CLI 不内置业务 Workflow。

仍在仓库根目录执行：

```sh
node apps/cli/dist/bin.js init my-project --workflow /absolute/path/to/workflow.tgz
node apps/cli/dist/bin.js --project my-project start
```

启动服务不会执行 Workflow。接下来选择执行方式：

- [CLI](./docs/zh/guide/quickstart/cli.md)：配置项目模型和凭据，再通过 `flow` 开始一个 Run。
- [Agent IDE / MCP](./docs/zh/guide/quickstart/mcp.md)：连接 Codex 或其他具备相应能力的 MCP 客户端。默认客户端 Agent 模式不需要项目模型配置。

回答问题并进行确认，继续同一个 Run。使用 `runs` 查看执行情况，使用 `attach` 从终端继续，使用 `artifacts` 查询保存的结果。流程完成与业务结果的质量是两件不同的事。

## 项目状态

IntLoom 仍处于早期开发阶段。本地 Workflow 执行、CLI/MCP 接入、文件与 SQLite 存储，以及有限的重启恢复已经实现。Studio 仍在规划中。

模型表现与客户端支持需要在实际使用环境中验证。支持的行为和验证边界见[当前能力](./docs/zh/guide/status.md)。

## 文档

- [关于 IntLoom](./docs/zh/guide/introduction.md)
- [开始使用](./docs/zh/guide/getting-started.md)
- [CLI 命令参考](./docs/zh/guide/reference/cli.md)
- [创建 Workflow](./docs/zh/guide/development/create.md)
