# Kernel 架构设计

## 1. 定位与职责

Kernel 根据 [Workflow](./workflow.md) 和 [Stage](./stage.md) 定义执行流程，负责资源解析、执行调度、交互等待、运行恢复和错误中断。

Kernel 提供 State 与项目资源 API，调度器只根据最终 Outcome 推进流程。业务职责见 [Stage 数据访问](./stage.md#4-数据访问)。

## 2. 运行管理

每次流程执行创建一个 Workflow Run，统一维护当前 Stage、Step、运行状态和当前调用：

```text
Workflow Run
├─ id
├─ workflowId
├─ stageInputs
├─ currentStage
├─ currentStep
├─ status
└─ currentCall
   ├─ input
   └─ result
```

运行位置、Stage 输入、等待状态和当前调用信息由 Kernel 保存恢复。

创建 Workflow Run 时，按 Workflow 中各 Stage 的输入映射解析参数，以阶段键名保存到 `stageInputs`，不另存 Workflow Input。启动或恢复 Stage 时，从中取得对应的 `stageInput`；后续 Stage 的参数也已保留，无需调用方重新传入。

### 当前调用

一次 Step 执行中的 preHook 临时输出、实际输入、等待进度和原始返回都关联到当前调用。结果处理成功并记录流程推进后，清理本次调用的临时信息。

例如某个交互 Step 等待用户时：

```yaml
currentStage: example-stage
currentStep: clarify
status: waiting
currentCall:
  input:
    questions:
      - id: Q1
        question: 是否允许删除任务？
```

用户回答后，本次调用获得 `result`：

```yaml
answers:
  - questionId: Q1
    answer: 允许
```

Kernel 恢复当前调用并执行其 postHook。业务 Hook 根据返回结果更新 State，Kernel 根据最终 Outcome 和 Stage 的 `on` 配置推进执行。

## 3. 执行流程

Workflow 从 `entry` Stage 开始，Stage 从 `entry` Step 开始：

```text
执行 preHook（如有）
→ 解析 Step input
→ 执行 Agent / Code / Kernel 能力
→ 执行 postHook（如有）
→ 取得最终 Outcome
→ 匹配 on，保存运行进度并推进
```

| 执行方式 | Kernel 的分发职责 |
| --- | --- |
| Agent | 解析 Agent，按定义加载 Skills / Tools 并调用执行器 |
| Code | 定位代码入口，提供 Execution Context 并执行；Hook 复用此机制 |
| Kernel 能力 | 定位通用能力，传入已映射的 `input` |

输入映射与最终 Outcome 的取值遵循 [Step Hook 规则](./stage.md#step-hook)。

Step 的 `end: true` 完成当前 Stage，并向 Workflow 返回 `complete`；Workflow 再继续下一 Stage 或结束。业务步骤及产物生成方式由 Stage 定义。

## 4. Execution Context

Execution Context 是 Kernel 提供给 Agent / Code / Hook 的数据与 API 入口，接口约定如下：

```text
ExecutionContext
├─ workflowRunId          当前流程标识
├─ stageInput             调用方传给 Stage 的只读参数
├─ input                  当前 Step 映射后的实际输入
├─ result                 主执行的原始返回，供 postHook 使用
├─ state
│  ├─ value               当前 Stage State 的只读视图
│  ├─ create(value)       创建 State
│  ├─ update(value)       保存完整的新 State
│  └─ clear()             清除 State
└─ project
   ├─ read(ref)           读取项目资源
   └─ write(ref, data)     写入项目资源
```

`input` 在 preHook 后生成，`result` 在主执行返回后生成。

State API 作用于当前 Workflow Run 中的当前 Stage。`update` 保存调用方计算好的完整 State；Kernel 不计算差异或合并业务字段。

项目资源的引用、内容和生成规则由 Stage 约定。Kernel 只提供通用存取接口，例如 `context.project.read("example-stage/artifact")`。

### 使用示例

以下业务 postHook 演示如何使用返回结果和 State API；示例中的问答字段由调用方的业务 Schema 定义：

```javascript
const current = context.state.value;
const answers = new Map(
  context.result.answers.map(item => [item.questionId, item.answer])
);

const next = {
  ...current,
  questions: current.questions.map(question =>
    answers.has(question.id)
      ? { ...question, answer: answers.get(question.id) }
      : question
  )
};

await context.state.update(next);
return { outcome: "complete" };
```

回答如何对应问题由业务 Code 决定，Kernel API 只保存传入的数据。

## 5. 检查、错误与执行约束

执行前检查入口和跳转目标、Stage / Agent / Code / Kernel 能力资源、Hook 引用、Schema 引用及 Skills / Tools 是否可解析，并检查是否存在终止路径。State 的内容校验由 Stage 负责。

以下情况抛出对应类型的错误，并中断当前执行：

| 错误类别 | 情况 |
| --- | --- |
| 定义与资源错误 | 定义结构、入口、跳转目标或资源引用不合法 |
| 流转匹配错误 | 最终 Outcome 没有匹配的 `on` |
| 执行错误 | Agent、Code、Hook、Kernel 能力或存取 API 执行失败 |
| 返回协议错误 | 返回不符合当前执行阶段的协议 |

`client-questions` 提供提问交互，`client-confirm` 提供确认交互。等待用户期间保持当前 Step；恢复后继续处理原调用。

MVP 中，同一项目的 Workflow Run 串行执行。具体错误类型、重试与恢复机制、存储实现留待后续设计。
