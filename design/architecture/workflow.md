# Workflow 架构设计

## 1. 定位与职责

Workflow 负责 Stage 之间的编排，定义开发从哪个 Stage 开始、完成后进入哪个 Stage，以及何时结束。

Stage 负责内部业务流程、State 和产物内容。

## 2. 定义结构

Workflow Definition 由标识、输入、入口和阶段配置组成：

| 字段 | 含义 |
| --- | --- |
| `id` | Workflow 标识 |
| `input` | 外部输入名称，如 `intent` |
| `entry` | 首个执行的 Stage，对应 `stages` 中的键名 |
| `stages` | 以阶段名称为键的配置集合 |
| `stages.<name>.stage` | 引用的 Stage Resource |
| `stages.<name>.input` | 传给该 Stage 的输入映射 |
| `stages.<name>.on` | Stage Outcome 对应的流转配置 |

## 3. 运行方式

每次执行创建一个 Workflow Run，从 `entry` 开始，按 Stage Outcome 决定后续流转。MVP 主路径使用 `complete`：

- `on.complete.target`：进入 `stages` 中指定的下一 Stage。
- `on.complete.end: true`：结束整个 Workflow。

```text
创建 Workflow Run
→ 启动 entry Stage
→ 等待 Stage Complete
→ 根据 Transition 启动下一 Stage
→ 重复，直到 end: true
```

澄清、修正、反馈和确认等内部流程由 Stage 处理。Workflow Definition 本身不保存运行状态。

## 4. 数据访问

Workflow Input 是外部调用者传入的数据。Workflow 按 Stage Input 映射传给需要的 Stage，不单独保存；例如将 `$workflow.input.intent` 映射为 Stage 的 `intent`。

输入映射只使用字面量和直接字段引用，数据转换由 Stage 的 Code 处理。

Artifact 和 Record 无需在 Workflow YAML 中传递，访问规则见 [Stage 数据访问](./stage.md#4-数据访问)。

## 5. 完整示例

以下配置示意输入映射、阶段转移和流程结束。阶段名称为占位名称，具体业务流程由 Workflow 配置决定。

```yaml
workflow:
  id: example-workflow
  input:
    - request
  entry: first

  stages:
    first:
      stage: "@stages/example-first"
      input:
        request: "$workflow.input.request"
      on:
        complete:
          target: second

    second:
      stage: "@stages/example-second"
      on:
        complete:
          end: true
```

开发阶段的协作规则见 [Stage 公共约定](../stages/README.md)。
