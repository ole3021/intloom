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

## 创建与查看 Run

使用 `intloom` 或 `intloom tui` 打开常驻界面，选择 Workflow、输入完整多行意图，Ctrl+Enter 提交。TUI 展示问题选项和确认；关闭界面保留待答动作。

CMD 通过明确参数调用，即时返回接收回执：

```sh
intloom flow your_flow --intent-file intent.txt --json
intloom wait <runId> --json
intloom attach <runId> --json
intloom answer <runId> --action <actionId> --answer-file answer.json --json
```

普通 JSON 使用 ok/data/meta。接收不等于完成；回执中检查 data.run.status，Run 查询检查 data.status。回答是完整问题数组或确认对象。wait 不回答，也不取消执行。见 [CLI 参考](../reference/cli.md)。

失败可能保留正式成果，应检查 Run 引用和日志后再创建新执行。统计在 Service 停止或恢复时重置；真实模型行为另行验收。
