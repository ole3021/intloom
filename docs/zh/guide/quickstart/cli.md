---
title: 通过 CLI 运行
description: 使用项目服务中配置的模型执行 Workflow。
---

# 通过 CLI 运行

先完成[项目配置](./installation.md)，并安装兼容的 Workflow。即使 `useMcpAgent` 为 true，CLI 创建的 Run 也始终使用服务端执行方式。

## 配置服务模型

在 `intloom.yaml` 中添加真实的提供商配置，并保留生成的 Workflow 声明：

```yaml
llms:
  default:
    provider: openai-compatible
    model: your-model-id
    secret: ENV.MODEL_API_KEY
    baseURL: https://your-provider.example/v1
```

以上值是占位符，不是可用的服务地址。在启动服务的环境中安全提供 `MODEL_API_KEY`，YAML 中只保存变量引用。模型角色和提供商设置见[配置](../usage/configuration.md)。

服务端执行需要 `llms.default`，仅包含 Code 的 Workflow 也一样。创建 Run 前会检查相关 Agent 所需的凭据。已经运行的服务保留原来的配置和环境，修改后需要重启。

## 启动与检查

```sh
intloom start
intloom doctor --execution cli
intloom flows
```

预期结果是所需 Workflow 已加载，并可通过 CLI 执行。Doctor 检查配置和就绪状态，不会发送模型请求，因此不能证明模型兼容性或响应质量。

## 创建一个 Run

在交互式终端中运行：

```sh
intloom flow
```

选择 Workflow 并输入意图。也可以将下面的 `your_flow` 替换为已加载的名称：

```sh
intloom flow your_flow --intent "Describe the result you want"
```

回答问题并审核确认内容。选择修改会沿 Workflow 的反馈路由继续同一个 Run。多行输入中，Enter 换行，Tab 将焦点移到提交按钮，Enter 提交。取消尚未提交的表单会让 Run 继续等待。

## 继续或查看

```sh
intloom runs
intloom attach <runId>
intloom artifacts
```

将尖括号占位符替换为真实 ID。`attach` 继续已有 Run，`flow` 则创建新的 Run。

用于自动化时，同时提供 Workflow 名称和非空意图：

```sh
intloom flow your_flow --intent-file intent.txt --json
```

JSON 模式不会提问；它会在等待状态或终止状态返回。等待时退出码为 0 不代表执行完成，请检查 `run.status`。使用交互式 `attach`，或通过客户端提交待处理操作的答案来继续。详见[Run 管理](../usage/runs.md)。

执行失败时，先查看 `intloom logs <runId>` 和已提交的结果，再决定是否创建新的 Run。超时本身不会取消执行。提供商输出被截断、结构化输出无效或 Tool 失败时，需要进行诊断，详见[错误](../reference/errors.md)。

