---
title: Stages、Steps 与路由
description: 为编译后的工作流定义状态初始化和明确的 outcome 路由。
---

# Stages、Steps 与路由

源 YAML 定义两级路由。Step 路由到另一个 Step，或结束所属 Stage；Stage 再路由到另一个 Stage，或结束 Workflow。

## 明确声明 outcome 路由

```yaml
stage:
  name: review
  state:
    schema: "@schemas/review"
    initialize: "@initializers/review"
  entry: check
  steps:
    check:
      type: code
      code: "@codes/check"
      on:
        revise:
          target: revise
        accepted:
          end: true
    revise:
      type: code
      code: "@codes/revise"
      on:
        complete:
          target: check
```

该定义需要提供引用的模块。外层 Workflow 必须在这个 Stage 的路由中处理 `accepted`。`complete` 是部分包采用的约定，不是隐含的成功路由。

执行返回 `{ outcome: "revise" }` 时，转到命名的 Step。返回 `{ outcome: "accepted" }` 时，以该 outcome 结束 Stage。未处理的 outcome 会使 Run 失败；异常也会使执行失败，而不会自动选择路由。

## State 生命周期

进入 Stage 时，初始化器接收 `{ runId, flowName, stageName, intent }`。返回值由 Stage Schema 验证，并成为当前业务 State。每个 Stage 拥有独立的初始化值；离开 Stage 时，对它的访问会释放。

后续 Stage 需要早期正式结果时，通过 Storage 读取。前一个 Stage 的草稿不会自动合并到下一个 Stage。清空 State 不会触发自动重新初始化。

## Agent Steps

```yaml
review:
  type: agent
  agent: "@agents/reviewer"
  llm: review
  outputSchema: "@schemas/review-result"
  tools:
    - "@tools/review:readDraft"
  skills:
    - "@skills/review"
  on:
    accepted:
      end: true
    revise:
      target: revise
```

Agent 最终输出 Schema 必须能够解析出有效的 Step 结果。通过业务 Tools 保存分析和提案，最终输出只包含路由 outcome。`llm` 角色在服务执行时选择项目配置，在客户端执行时仍保留在任务描述中。

## 并发与循环

需要避免同一服务内其他活跃 Run 重叠执行的项目写入工作流，应设置 `workflow.exclusive: true`。独占范围包括人工等待和 Agent 等待，但不能阻止独立的外部编辑器修改文件。

路由可以形成循环。在 State 中定义业务修复次数预算，并由 Code 执行限制；拓扑本身不保证业务语义上的自动终止。用户等待或外部操作后，上游数据可能变化，需要重新验证假设。

字段说明见 [YAML 参考](../reference/workflow-yaml.md)，Code 和 Agent 契约见[执行资源](./execution.md)。

