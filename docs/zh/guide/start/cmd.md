---
title: 通过 CMD 完成第一次运行
---

# 通过 CMD 完成第一次运行

先完成[安装](./installation.md)、[初始化](./project.md)和 [Workflow 安装](./workflow.md)。本教程使用 `intent`。

## 准备服务执行环境

在生成的 `intloom.yaml` 中加入真实的模型配置，保留原有字段和已安装 Workflow 声明：

```yaml
llms:
  default:
    provider: openai-compatible
    model: your-model
    secret: ENV.MODEL_API_KEY
    baseURL: https://your-provider.example/v1
```

替换占位值，并在启动 Service 的环境中提供 `MODEL_API_KEY`。[模型配置](../usage/configuration.md)说明支持的提供方与角色。

```sh
intloom stop
intloom start
intloom doctor --execution cli
intloom looms
intloom run intent --prompt "Build a Todo app with local persistence"
```

保存返回的 Run ID。`doctor` 只检查就绪状态，不调用模型；flow 回执表示接收工作，并不表示流程已经完成。

## 继续同一个 Run

```sh
intloom wait RUN-example
intloom attach RUN-example --json
```

把 `RUN-example` 替换为实际 ID。出现 `pendingAction` 时，阅读完整问题或确认内容，并把用户回答保存为 JSON：

```json
{"isConfirmed": true}
```

确认操作使用精确的当前 action ID 提交该文件：

```sh
intloom answer RUN-example --action ASK-example --answer-file ./answer.json
intloom wait RUN-example
```

问题操作需要完整回答数组，参见 [Run 管理](../usage/runs.md)。重复观察和回答，直到终态。

## 阅读结果

```sh
intloom artifacts --loom intent
intloom records --loom intent
intloom artifact --loom intent --stage validation
```

阅读 Validation 的发现和检查结果。[CMD 指南](../usage/cmd.md)介绍脚本使用，[Intent 完整示例](../intent/walkthrough.md)介绍四个阶段。
