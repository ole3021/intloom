---
title: Loom Package 0.10
---

# Loom Package 0.10

一个 Loom 交付一个可调用能力。应用、代码和 Agent 共用输入输出契约，Loom 不依赖 Agent 才能执行。源码入口为 `loom.yaml`，Compiler 生成 `definition`、`plan`、`bindings`，Kernel 将计划接入既有执行引擎。

## 最小定义

```yaml
schemaVersion: "1"
name: normalize
version: "1.0.0"
input: {type: string, minLength: 1}
output: {type: string}
execute:
  code: ./code/run.ts#run
```

```ts
// code/run.ts
export function run(input: string): string {
  return input.trim();
}
```

最小包只需这两个文件，不需要 `package.json` 或 `tsconfig.build.json`。有外部依赖时，在 `package.json` 声明依赖、npm 身份与 `type: module`，版本与 `loom.yaml` 一致。自定义 TS 配置时需要安装 SDK 依赖。新入口不能与 `package.json.loom` 混用。

`LoomCode<Input, Output>` / `defineCode` 表示 `(input, context) => output`。Context 提供取消信号、Storage、可选 Project 和命名交互 `interaction.request(id, context)`。输入输出可以是任意 JSON 类型，包括 null。根 I/O 必须声明，`schemaVersion` 默认 `"1"`，description 可选。

## Agent、交互与验收

```yaml
schemaVersion: "1"
name: edit-text
version: "1.0.0"
input: {$ref: ./schemas/text.json}
output: {$ref: ./schemas/text.json}
agents:
  editor:
    definition: ./agents/editor.md
    modelProfile: standard
    interactions: [clarify]
execute: {agent: editor}
interactions:
  clarify:
    kind: form
    title: 请澄清原意
    context:
      type: object
      properties:
        question: {type: string}
      required: [question]
      additionalProperties: false
    response:
      type: object
      properties:
        answer: {type: string, minLength: 1}
      required: [answer]
      additionalProperties: false
  approve:
    kind: confirm
    title: 请确认交付结果
    context: {$ref: ./schemas/text.json}
acceptance:
  checks:
    - id: preserveMeaning
      code: ./code/check.ts#check
  confirmation: approve
```

Agent Markdown 使用 `name`、`description` YAML 头部，正文编写指令；模型、I/O、交互权限、Tool 和 Skill 引用留在根 Agent 配置。本轮不承诺支持所有厂商的 Agent 头部字段。直接执行的 Agent 默认继承根 I/O，也可显式覆盖；Workflow 内部 Agent 必须声明自己的 input/output，避免意外继承整个 Loom 契约。

```markdown
---
name: editor
description: 保持事实不变，整理输入文本。
---

根据输入完成整理。语义不明确时请求 clarify，按输出契约交付结果。
```

宿主自己的 `intloom.yaml` 配置实际模型：

```yaml
models:
  standard:
    provider: openai-compatible
    model: your-model-id
    secret: ENV.MODEL_API_KEY
    baseURL: https://your-provider.example/v1
```

支持 light、standard、deep 三档。内置执行使用到的档位必须明确配置，缺失时不回退。纯 Code 不要求模型配置。密钥由宿主解析，不写入 Loom 包。旧 Intent 的 `llms` 配置保持独立兼容。

交互是可选命名定义。form/select 声明 context 和 response Schema；选择项使用 enum 或数组表达。confirm 响应固定为 `{confirmed: true|false}`。Code 传入交互 ID 与数据；Agent 仅获得根声明允许的交互 Tool，参数为 `{context: ...}`。每次请求生成 action ID，宿主按当前请求校验回答，必要决定不能跳过。

MCP 对扁平基础字段和枚举提供表单，对复杂结构提供带 Schema 的 JSON 文本表单；TUI 使用校验后的 JSON 回答编辑器；CLI/API 可直接提交结构化回答。生产调用者应转交真人决定。E2E 模拟独立记录知识引用与 `actor: test_simulator`，不把模拟回答标记为真人确认。可选 `apps` 引用已构建 HTML，交互的 `app` 选择呈现资源，`presentation.result.app` 选择终态结果界面。宿主负责呈现，作者负责前端构建，详见 [Loom Apps](./loom-apps.md)。

`AcceptanceCheck` 接收独立的 `{input, output}` 和 context，返回 `{passed, message?, details?}`。检查器不能修改候选结果。顺序为输出结构检查 → 按序 checks → 可选最终确认 → 正式交付。失败或拒绝会结束任务，不返回正式 output，不自动修复或重试。通过仅表示已声明检查通过。

## Workflow 与开发调用

`execute: {workflow: ./workflows/main.yaml}` 引用顺序计划：

```yaml
steps:
  - id: normalize
    execute: {code: ../code/normalize.ts#run}
  - id: review
    execute: {agent: reviewer}
    input: {from: normalize}
output: {from: review}
```

input 默认 `{from: input}`，from 可以引用根输入或之前步骤，path 可选 JSON Pointer。可选 `when: {value: {from: input, path: /enabled}, equals: true}` 表示等值条件；引用已跳过步骤的输出会明确失败。中间 Code 输出必须为 JSON，Agent 边界与最终输出执行对应 Schema 检查。不包含并行、子 Loom 解析和隐式重试。

```sh
intloom new normalize --template code
intloom check ./normalize
intloom inspect ./normalize --json
intloom build ./normalize
# 使用既有安装流程安装 dist 包后调用。
intloom run normalize --input '"hello"'
intloom run normalize --input-file input.json
intloom attach RUN_ID --json
intloom answer RUN_ID --action ACTION_ID --answer '{"confirmed":true}'
```

check 执行静态编译、类型与产物检查，不替换 dist；inspect 展示新源码定义、引用和计划，不导入业务模块，也不代替 check；new 拒绝覆盖已有目录。build 保留锁、staging、声明、source map、依赖与资源检查、失败保护。公共 Compiler API 为 compileLoom、checkLoom、inspectLoom、scaffoldLoom。

程序继续使用 Operations：以 loomName、JSON input、serviceInstanceId 和新 operationId 提交 run，保留 runId 查询。成功完成后读取 Run.output；等待时处理 pendingAction 或 pendingAgentCall。回答使用当前 action ID，不能通过重建 Run 接续。外部 Agent task 携带业务 input 和 outputSchema。

listLooms 为新版能力返回 contract.input/output。日志附带生成步骤对应的源码文件和指针。SDK `/definition` 导出作者 Schema，`/compiled` 导出产物协议，`/loom.schema.json` 提供编辑器 Schema。调试、日志、运行查询继续由 Intloom 框架承担。

## 兼容及明确边界

源 schemaVersion `"1"`、产物协议 `"2026-10-27.2"`（继续读取 `"2026-10-27.1"` 和 `"2026-10-27"`） 与 npm 版本分别管理。保留旧源码、旧协议 `"2026-10-15"`、旧 SDK 根导出与现有 Intent；本轮不迁移其业务定义。Compiler/Kernel 依赖 SDK 契约，SDK 核心只依赖 Zod；可选浏览器入口另外使用可选 MCP peer 依赖。

新版 checkpoint 为 version 4，旧 version 3 可读取。最终 output 随终态保留。生成的最终确认可恢复保存的候选结果，不重复调用入口。Code 中途交互需要显式 `code.recover(saved, input, context)` 才能在重启后继续；任意 JS 执行栈和 Agent 会话不会自动重建，不确定执行返回 RUN_INTERRUPTED 并保留证据，不重放副作用。进程存活期间，外部 Agent 请求真人交互时临时交接等待，回答后恢复同一调用的所有权。

JSON Schema 支持受限的 draft 2020-12 子集：单一显式 type、对象 properties/required/additionalProperties、数组 items/长度、字符串长度/pattern、数值范围/multipleOf、enum/const、oneOf/anyOf、注释、包内 $ref/JSON Pointer。不支持远程或递归引用、其他组合关键字、format 或隐式类型转换；不支持的约束明确报错。required 键必须在 properties 声明。恢复匹配依据可执行内容身份，不能只依赖稳定资源 ID。

## 分支、显式续接与执行证据

`from: [structuredPreparation, naturalPreparation]` 汇合互斥分支：必须恰好一个来源产生结果；零个或多个都明确失败。仍禁止前向引用，`path` 在选出唯一结果之后应用。带条件的 Agent 到达实际分支时才准备模型。发现阶段的 readiness 表示可以受理，条件分支执行时仍可能要求对应模型档位；旧协议受理策略不变。

交互可声明 `validate: ./code/validation.ts#validateChoice`，导出同步 `InteractionValidator`：`(answer, requestContext) => {passed, message?}`。Kernel 先检查响应 Schema，再执行该规则，全部通过才消费请求。非法回答保留同一个等待，恢复后同样执行。校验器获得独立数据，不获得执行权限，不应产生副作用。

根 `agents.worker.resume: ./code/continue.ts#resume` 绑定 `AgentContinuation`。参数为 `(saved, originalInput, context)`，saved 包含原命名请求与已接受回答；返回 Agent 声明的业务输出。它只在恢复明确交互等待时运行，不恢复模型会话，也不重试任意中断的 Agent 调用。Code 保持 `code.recover` 续接方式。

`LoomContext.run` 提供 `id`、`startedAt` 和宿主上下文。宿主可配置：

```yaml
context:
  userId: local-user
  timeZone: Asia/Shanghai
  answerSource: human
  services:
    booking: http://127.0.0.1:4311
```

上下文随 Run 保存，等待恢复时不被新配置替换。服务 URL 不得包含密钥。宿主标记不等于身份认证平台；应用负责转交真人回答，自动化测试使用 `test_simulator`。

有效回答会持久化 `InteractionReceipt`：action ID、run ID、完整请求及上下文、回答、接受时间和宿主回答者信息。Code 通过 `context.interaction.receipt(id)` / `latest(interactionId)` 获取独立副本，运行快照提供 `interactionReceipts`。执行写操作前可以核对确认回执与完整业务内容；布尔值或 Agent 的口头声明不能代替回执。

作者可抛出 `new LoomFailure("BUSINESS_REASON", "可向用户展示的原因")`。运行错误保留 `STEP_EXECUTION_FAILED`，展示明确声明的原因；普通异常不直接暴露底层详情。原因中不要放凭据或原始提供商响应。

Compiler 通过可选 `bindings.validators`、`bindings.continuations` 链接校验器与续接函数。代码引用的包内 JSON 资源随模块进行类型检查、复制和产物校验；仍然只有 definition/plan/bindings 三个命名导出。

[会议室 Demo](https://github.com/ole3021/intloom/tree/main/examples/meeting-room-demo) 展示这些契约。服务请求和回执与正式交付分开保存：运行取消或验收失败不抹去真实外部效果；核实只查原业务请求 ID，不默默重新创建。
