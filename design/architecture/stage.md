# Stage 架构设计

## 1. 定位与职责

Stage 负责一个业务阶段内部的流程编排，定义经过哪些 Step、每个 Step 如何执行、执行结果进入哪个 Step，以及何时结束。

Step 执行具体业务或调用通用能力；Workflow 负责 Stage 之间的流转。执行调度与运行管理见 [Kernel 架构设计](./kernel.md)。

## 2. 定义结构

Stage Definition 由标识、输入、私有状态、入口和步骤配置组成：

| 字段 | 含义 |
| --- | --- |
| `id` | Stage 标识 |
| `input` | 接收的输入名称，如 `intent` |
| `state.schema` | 当前 Stage 的私有 State Schema |
| `entry` | 首个执行的 Step，对应 `steps` 中的键名 |
| `steps` | 以步骤名称为键的配置集合 |
| `steps.<name>.input` | 传给该 Step 的显式输入映射 |
| `steps.<name>.preHook` | 执行前准备或转换输入的 Code 引用，可选 |
| `steps.<name>.postHook` | 执行后处理返回结果的 Code 引用，可选 |
| `steps.<name>.on` | Step Outcome 对应的流转配置 |

每个 Step 声明其执行方式：

| 执行方式 | 声明 | 用途 |
| --- | --- | --- |
| Agent | `type: agent`、`agent` | 指定执行业务分析的 Agent；`skills` 声明额外加载的 Skill，`tools` 声明可使用的 Tool |
| Code | `type: code`、`code` | 执行确定性校验、持久化、文件操作、数据转换和最终结果生成 |
| Kernel Capability | `use: "@kernel:..."` | 调用通用能力，通过 `input` 映射请求参数 |

Agent 的基础职责由 Agent Definition 维护。

## 3. 运行方式

Stage 从 `entry` 开始执行。只有需要独立流程跳转的动作才定义为 Step；读取资源、调用模型、校验和更新状态等操作可在 Step 内完成。

Stage 的 Agent 或 Code 通过 State API 完成业务更新，最终 Step 结果只要求 Outcome，Stage 通过 `on` 决定后续流转：

- `on.<outcome>.target`：进入 `steps` 中指定的下一 Step。
- 最终 Step 的 `on.complete.end: true`：完成当前 Stage。

### Step Hook

Hook 属于 Stage，复用 Code 执行机制，适用于 Agent、Code 和 Kernel 能力调用。

| Hook | 读取内容 | 处理与返回 |
| --- | --- | --- |
| `preHook` | Stage Input、只读 State、Context | `output`，供 `input` 映射使用 |
| `postHook` | Stage Input、State、Context、本次实际输入和执行结果 | 处理结果，按需通过 State API 更新 State，并返回 Outcome |

```text
执行 preHook
→ 解析 input
→ 执行 Agent / Code / Kernel 能力
→ 执行 postHook
→ 根据最终 Outcome 执行 on
```

`input` 仅支持字面量和直接字段引用（如 `$preHook.output`），有 preHook 时先执行再解析；数据转换由 Code 完成。

postHook 处理执行结果并返回最终 Outcome；省略时沿用主执行的 Outcome。

## 4. 数据访问

Input 是调用方提供的参数，State 是 Stage 的私有业务工作状态。

数据与存取 API 通过 [Execution Context](./kernel.md#4-execution-context) 提供。

| 对象 | 内容与访问规则 |
| --- | --- |
| Input | 少量、稳定的调用参数；Stage 启动后只读 |
| State | 当前 Stage 的私有工作状态；YAML 可使用 `$state` 字段引用 |
| Artifact | 项目级阶段产物，保存当前完整结果；默认读取对应 Stage 的最新文档 |
| Record | Stage 按业务契约生成的历史记录，通过项目资源 API 存取 |

`state.schema` 是 Stage 的数据契约，初始化、业务校验、更新和清理由 Stage 的 Agent / Code 负责。每轮处理使用新的 State，同一 Stage 的多个 Step 共享它。

Stage 决定 State API 的调用时机与保存内容。Artifact / Record 通过项目资源 API 访问，无需通过 Input 反复传递。

具体字段、记录标识、产物保存和跨阶段协作规则由业务层定义，见 [Stage 公共约定](../stages/README.md)。

## 5. 完整示例

以下配置示意 Agent、交互能力、Hook 与 Code 的组合，以及 Outcome 分支和阶段结束。示例名称为占位名称，具体步骤和业务条件由各 Stage 定义。

```yaml
stage:
  id: example-stage

  input:
    - intent

  state:
    schema: "@schemas/example-state"

  entry: analyze

  steps:
    analyze:
      type: agent
      agent: "@agents/example-agent"
      skills: []
      tools: []

      on:
        clarification_required:
          target: clarify

        repair_required:
          target: analyze

        ready:
          target: confirm

    clarify:
      use: "@kernel:client-questions"
      preHook: "@codes/example-stage/hooks:clarify-preHook"
      postHook: "@codes/example-stage/hooks:clarify-postHook"

      input:
        questions: "$preHook.output.questions"

      on:
        complete:
          target: analyze

    confirm:
      use: "@kernel:client-confirm"
      preHook: "@codes/example-stage/hooks:confirm-preHook"
      postHook: "@codes/example-stage/hooks:confirm-postHook"

      input:
        context: "$preHook.output.context"

      on:
        feedback:
          target: analyze

        confirmed:
          target: finalize

    finalize:
      type: code
      code: "@codes/example-stage/finalize"

      on:
        complete:
          end: true
```
