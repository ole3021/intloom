# Solution Stage 设计

本文定义 Solution 的设计模型、变化规则、澄清确认和结果生成逻辑。公共约定见 [Stage 数据与文档约定](../README.md)，流程声明见 [solution.yaml](../../../workflows/stages/solution.yaml)。

## 1. 目标与产物

Solution 将已确认的 Specification 转换为清晰、稳定、可实现、可验证的目标设计，负责架构结构、运行场景、核心概念、关键设计决策、风险和架构图。

| 产物 | 业务含义 |
| --- | --- |
| Solution Artifact | 应用本轮变化后的完整目标设计，作为 Implementation 的正式设计依据 |
| Solution Record | 本轮 Solution 变化、来源引用、原因、真实问答和反馈 |

数据结构见 [artifact.ts](./artifact.ts)、[state.ts](./state.ts) 和 [record.ts](./record.ts)。

## 2. Solution 模型

Solution Artifact 包含以下核心内容：

| 对象 | 业务含义 |
| --- | --- |
| Structure | 系统静态结构与长期稳定边界，包括 App、Package、Module、Resource 和 Relation |
| Scenario | 将一组 Requirement 转换为端到端的模块 / 资源协作流程 |
| Concept | 跨 Module / Scenario 共同遵守的设计概念与规则 |
| Decision | 已经确认并需要 Implementation 遵守的重要设计决定 |
| Risk | 已识别但尚未解除的设计风险或不确定性 |
| Diagram | 与 Solution 同步生成并保存的固定视觉表达 |

系统边界、业务目标与需求范围来自 Specification Artifact 和本轮 Specification Record。Solution 保存最终设计结果，设计决策通过 Decision 说明选择及原因。

对象按集合保存，通过稳定 ID 关联。可选字段无内容时省略，空集合使用 `[]`，不使用 `null` 占位。正文字符串必须包含非空白内容。

## 3. Structure

### Apps

App 表示可独立运行或交付的应用，例如 Web、Mobile、Service 或 Worker。

每个 App 包含：

- 稳定 `id`
- `name`
- `type`
- 应用职责和边界 `description`
- 可选的架构级 `technologies`
- 必须明确维护的 `modules`

`technologies` 只记录会影响 Solution 的技术，即替换该技术会要求重新设计 Solution 时才记录。允许的类别包括：

| 类型 | 含义 |
| --- | --- |
| `platform` | 目标运行平台或托管环境 |
| `language` | 对架构有决定性影响的主要实现语言 |
| `runtime` | 承载应用执行的运行时环境 |
| `framework` | 对应用结构或开发模型有决定性影响的框架 |

没有版本时表示 Solution 不约束版本，不隐含“使用最新版本”。

### Packages

Package 表示项目内部的代码组织和分发边界，主要用于 Monorepo 中跨 App 共享的代码单元。

Package 必须包含至少一个 Module。Package 本身不承担具体业务职责，具体职责、需求承接和接口由其 Module 表达。

### Modules

Module 是 Structure 中主要承载架构职责的构建块。

每个 Module 包含：

- 稳定 `id`
- `name`
- 职责和边界 `description`
- 可选 `requirement_refs`
- 可选 `constraint_refs`
- 可选 `interfaces`

Module 保存 `parent_ref` 和 `status: active / retired`。App 内的 `parent_ref` 类型为 `OAPP_ID`，Package 内为 `OPACKAGE_ID`；父引用须与实际所属对象 ID 一致。新增 Module 根据完整对象中的 `parent_ref` 定位父对象。

Module 直接隶属 App 或 Package，以同级集合组织。新建时使用 `active`，退出时改为 `retired`，保留身份和定义。

### Interfaces

Interface 只表达 Module 对外提供的稳定能力，不表达 Module 所依赖的能力。

依赖关系由 Structure Relation 和 Scenario 表达。

| 类型 | 含义 |
| --- | --- |
| `call` | 对外提供可被主动调用的能力；调用方发起请求并获得处理结果，不限定协议或实现方式 |
| `event` | 对外发布异步事件或消息，用于通知或异步协作 |

Interface 不描述具体 HTTP Path、RPC Method、SDK 调用或代码签名。

### Resources

Resource 表示系统依赖的逻辑架构资源和能力，不绑定具体厂商、产品或环境实例。

典型 Resource 包括：

- Database
- Message Bus
- Cache
- Object Storage
- External Service

Resource 可以声明架构级 `capabilities`。只有会影响 Solution 的能力才记录，例如：

- ordered delivery
- replay
- durable storage
- transactional consistency
- strong consistency

Resource 定义逻辑能力与约束，具体产品、连接信息和部署参数不属于其设计字段。

### Relations

Relation 表达 Structure 对象之间被设计允许并需要长期保持的架构关系，不是运行时调用日志。

Relation 两端可以引用 App、Module、Package 或 Resource。

常见关系包括：

| 类型 | 含义 |
| --- | --- |
| `depends_on` | source 在架构上依赖 target |
| `calls` | source 在运行时可以同步调用 target 提供的能力 |
| `uses` | source 在结构上使用 target 提供的共享能力 |
| `reads` | source 从 target Resource 读取数据 |
| `writes` | source 向 target Resource 写入数据 |
| `publishes` | source 向 target 发布事件或消息 |
| `subscribes` | source 订阅 target 提供的事件或消息 |

`calls` 表达运行时调用能力，`uses` 表达静态复用关系，两者不得混用。

具体业务流程中的协作顺序由 Scenario 表达。

## 4. Scenarios

Scenario 表达有架构意义的运行时协作，将一组 Functional Requirement 转换为当前 Structure 下的端到端设计流程。

Scenario 主要关联 `requirement_refs`，不直接承载 Constraint。Constraint 通过 Module、Resource、Concept、Decision 等设计对象影响 Solution。

每个 Scenario 包含：

- 稳定 `id`
- 生命周期状态
- 场景目标、范围和关键协作语义
- `requirement_refs`
- 可选 `initial_state`
- `participants`
- 有序 `steps`
- `outcomes`

### Participants

Participant 是 Scenario 内部用于描述交互的参与方。

| 类型 | 说明 |
| --- | --- |
| `module` | 引用 Structure 中的 Module |
| `resource` | 引用 Structure 中的 Resource |
| `actor` | 用户或业务角色 |
| `external_system` | Solution 边界外的系统 |

`module` 和 `resource` 必须提供 `ref`；`actor` 和 `external_system` 不需要 Structure 引用。

Step 不直接引用 App，而通过 Participant 表达参与方。

### Steps

`steps` 按数组顺序表达场景中的关键协作。

每个 Step 包含：

- `id`
- `source_ref`
- 可选 `target_ref`
- `type`
- `action`

支持的动作类型：

| 类型 | 含义 |
| --- | --- |
| `call` | 调用另一个参与方提供的能力 |
| `return` | 返回之前调用的结果 |
| `event` | 发布或传递异步事件 / 消息 |
| `read` | 从 Resource 读取内容 |
| `write` | 向 Resource 写入内容 |
| `start` | 启动进程、任务或组件 |
| `stop` | 停止进程、任务或组件 |
| `activity` | 参与方内部完成的行为，不强调外部交互 |

`activity` 可以省略 `target_ref`。

Scenario 不保存 HTTP 参数、数据库语句、函数调用等 Implementation 细节。

### Outcomes

Outcome 表达 Scenario 完成后应当可观察、可验证的结果，为后续集成验证提供依据，但不替代 Specification Acceptance。

| 类型 | 含义 |
| --- | --- |
| `response` | 调用方直接获得的同步结果 |
| `state` | 场景完成后系统必须成立的状态 |
| `event` | 应当产生的异步事件或消息 |
| `external_effect` | 对系统边界之外产生的可观察副作用 |

一个 Scenario 表达一条清晰路径。不同且具有独立业务意义的分支使用不同 Scenario，不引入 `alternatives` 分支树。

## 5. Concepts

Concept 表达跨 Module / Scenario 需要共同理解和遵守的设计概念与规则。

每个 Concept 包含：

- 稳定 `id`
- `name`
- 生命周期状态
- `definition`
- 可选 `scope_refs`
- 可选 `requirement_refs`
- 可选 `constraint_refs`
- `rules`
- `record_refs`

`definition` 说明 Concept 的明确含义和边界；`rules` 保存所有适用对象必须共同遵守的设计规则。

典型 Concept 包括：

- Idempotency
- Session
- Money
- Correlation
- Authorization Context

`scope_refs` 省略时表示 Concept 对整个 Solution 通用。

## 6. Decisions

Decision 保存已经确认并需要后续 Implementation 遵守的重要设计决定。

每个 Decision 包含：

- 稳定 `id`
- `name`
- 生命周期状态
- `decision`
- `reason`
- 可选 `scope_refs`
- 可选 `requirement_refs`
- 可选 `constraint_refs`
- `record_refs`

`decision` 表达最终决定了什么，`reason` 说明为什么该决定对当前 Solution 必要或合理。

`scope_refs` 省略时表示全局设计决定。

Decision 不保存完整 Agent 推理过程，也不强制保存 alternatives / consequences；相关影响应体现在 Structure、Scenario、Concept、Risk 或 Implementation 约束中。

## 7. Risks

Risk 保存已经识别但尚未解除的设计风险或不确定性。

每个 Risk 包含：

- 稳定 `id`
- `name`
- 生命周期状态
- `description`
- `impact`
- 可选 `mitigation`
- 可选 `scope_refs`
- 可选 `requirement_refs`
- 可选 `constraint_refs`
- `record_refs`

Risk 说明风险是什么、可能造成什么影响，以及当前已经确定的缓解措施。

没有明确缓解措施时省略 `mitigation`，不生成占位方案。

Risk 保存设计风险与不确定性，内容须明确影响、作用范围及已确定的缓解措施。

## 8. Diagrams

Diagram 与 Solution 同步生成并持久化，是同一设计事实的固定视觉表达，不是第二事实源。

权威信息仍然来自 Structure、Scenario、Concept、Decision 和 Risk。

当前支持四类 Diagram：

| 类型 | 含义 |
| --- | --- |
| `overview` | 项目总体架构图，主要表达 Apps、Packages、Resources 和关键 Relations |
| `component` | 单个 App / Service 的内部组件图，重点表达 Modules、Resources 和 Relations |
| `scenario` | 对应 Scenario 的运行时交互图 |
| `state` | 核心业务或技术对象的状态 / 生命周期图 |

Diagram 使用 D2 作为统一源码格式，`d2_code` 必填。

每个 Diagram 通过 `refs` 指向其表达或依据的 Solution 对象，不重新定义设计事实。相关设计内容变化时，对应 Diagram 必须同步更新。

不维护部署图。

## 9. 与 Specification 的承接

Solution 通过 Requirement / Constraint 引用承接 Specification。

主要关系：

```text
Requirement
→ Module / Resource / Relation / Scenario / Concept / Decision / Risk

Constraint
→ Module / Resource / Relation / Concept / Decision / Risk
```

Feature 主要用于 Specification 内部组织，不要求 Solution 重复引用；通过 Requirement 可以反向追踪所属 Feature。

Scenario 聚焦 Functional Requirement，不直接关联 Constraint。

Solution 不复制 Specification 内容，只记录设计如何承接和落实这些要求。

Solution 通过 Execution Context 读取 Specification Artifact 和本轮 Specification Record。各设计对象按其类型声明使用 `requirement_refs / constraint_refs` 关联需求与约束。

## 10. 设计职责范围

Solution 明确以下内容及其变化：

- App / Package / Module 的职责与边界；
- Module Interface 的能力；
- Resource 的架构能力；
- Structure Relation 的依赖和协作关系；
- Scenario 的参与者、步骤与结果；
- Concept Rule 的共同约定；
- Decision 的架构选择及原因。

设计正文应准确表达必须遵守的契约，具体实现细节保持在代码层面。

## 11. 设计产物要求

Solution Artifact 必须可读、可引用、可追踪、可实现和可验证。每项设计应明确职责、边界、引用与适用条件，使实际实现可以与设计内容对照。

内部一致性检查包括：

- 结构对象的身份、归属和职责一致；
- Interface 能力与所属 Module 职责一致；
- Structure Relation 的方向、类型与正文一致；
- Scenario 使用的参与者、接口和资源有对应设计依据；
- Concept Rules 与 Decision 的作用范围明确；
- 生命周期状态与有效对象的引用一致；
- Diagram 准确表达正文中的设计事实。

## 12. 来源与生命周期

Solution 对象使用稳定 ID，已有身份不重用。不同对象的生命周期与来源字段并不相同：

| 对象 | `status` | `record_refs` |
| --- | --- | --- |
| App / Package / Interface / Resource / Structure Relation | 无 | 无 |
| Module / Scenario | `active / retired` | 无 |
| Concept / Decision / Risk / Diagram | `active / retired` | `RUN_ID[]` |

App、Package 创建后持续保留。Module 新建时为 `active`，退出时改为 `retired`，保留 ID、归属与定义。App、Package、Module 禁止直接删除，也不能通过移除父对象或整体替换集合间接删除。

具有 `status` 的对象退役时，应同步处理有效设计对它的引用。Module 退役前须明确其剩余职责、调用方和数据处理要求；具体规则见第 16 节。

`record_refs` 关联设计形成或变化的 Solution Record，使用所属 `RUN_ID`。Finalize 对发生实质变化且具有此字段的对象去重追加本轮 Run ID；新对象的 `record_refs` 初始化为 `[]`。

Diagram 与正文在同一次 Finalize 中生成并保存，保证同一 Revision 内一致。

## 13. 核心结构

```text
Solution Artifact
│
├─ Structure
│  ├─ Apps
│  │  └─ Modules
│  │     └─ Interfaces
│  ├─ Packages
│  │  └─ Modules
│  │     └─ Interfaces
│  ├─ Resources
│  └─ Relations
│
├─ Scenarios
│  ├─ Participants
│  ├─ Steps
│  └─ Outcomes
│
├─ Concepts
│  └─ Rules
│
├─ Decisions
├─ Risks
└─ Diagrams
```

该结构借鉴 arc42 的 Building Block、Runtime View、Cross-cutting Concepts、Architecture Decisions 和 Risks，使用 D2 提供固定架构可视化。

## 14. State、Changes 与 Record

State 保存 `id: RUN_ID`、本轮累计 `changes`、`questions` 和 `feedbacks`。Design 通过 Execution Context 读取 Specification、Solution 以及本轮相关记录，修订待确认 Changes。

每条 Change 包含：

| 字段 | 类型与职责 |
| --- | --- |
| `target_ref` | 单个 Structure 对象、Interface、Structure Relation、Scenario、Concept、Decision、Risk 或 Diagram ID |
| `reason` | 修改依据及下游需要关注的影响 |
| `patch` | 相对目标的 `test / add / replace / remove` JSON Patch |

Interface 作为直接目标时，从所属 Module 的 `interfaces` 集合定位。Participant、Scenario Step 的变化在所属 Scenario 中表达，Concept Rule 的变化在所属 Concept 中表达。补丁必须满足目标字段类型、稳定身份、引用有效性和设计边界约束。

Record 包含 `id / origin_refs / changes / questions / feedbacks`。顶层 `origin_refs` 汇总本轮变动涉及的来源对象，使用一维、无序、去重的 `(SPEC_CHANGE_REFS | SOLUTION_CHANGE_REFS)[]`，无来源对象时为 `[]`。每条 Change 的 `target_ref` 定位修改对象，`reason` 说明修改依据及影响。

Questions 只保存真实已回答的内容；Feedbacks 保存本轮已处理的 `user / check` 反馈。两个 Record 字段均为一维列表，不按交互批次分组。

## 15. 工作流程与确认

YAML 声明的流程为：

```text
design → design postHook → clarify / design / confirm
clarify.complete → design
confirm.feedback → design
confirm.confirmed → finalize
finalize.repair_required → design
finalize.complete → 完成阶段
```

Design 创建或更新 Questions；Clarify 的 postHook 写入真实回答。Confirm 的 postHook 将用户反馈写入 `feedbacks`，来源为 `user`；设计检查和保存前检查的可修正诊断使用来源 `check`。同一轮修订累计 Changes，不生成多个本轮 Record。

Design postHook 检查拟确认的 Changes；需要澄清时允许设计尚未完整。进入最终确认前，应解决阻塞问题、处理本轮反馈并通过相应确定性检查。反馈处理以修订结果和检查事实为依据。允许保留的非阻塞不确定性按 Risk 表达，不伪造用户答复或缓解方案。

Finalize 复核确认内容，在副本上应用最终 Changes，检查正文、Diagram、引用和生命周期的一致性，生成本轮 Record，并维护具有 `record_refs` 的对象来源。先保存新的 Artifact Revision，再保存 Record，成功后清理 State 并返回 `complete`；部分保存失败不报告阶段完成，重试复用本轮 Run ID 和已确定内容。

`finalize.repair_required` 用于可修正设计问题，回到 Design 后重新确认。保存失败时保留工作状态，不报告完成。

## 16. 设计调整边界

### 创建、修改与保留

Solution 可以根据需求新建 App、Package、Module，并修改它们的职责与边界。App、Package 创建后保留在设计中；Module 通过 `active / retired` 表达生命周期。

已有对象保留稳定 ID。App、Package、Module 禁止直接删除，不得通过新 ID 替换、父集合整体替换或嵌套移除绕过保留规则。修改职责、边界或归属时，须同步父引用、接口、关系、场景、共同规则与 Diagram，保证设计一致。

| 变化 | 处理规则 |
| --- | --- |
| 新建 App、Package 或 Module | 明确职责、归属和依赖；新 Module 使用 `active` |
| 修改 App、Package 或 Module 的职责与边界 | 保留身份，更新受影响的设计对象和引用 |
| Module 仅有部分职责被取消 | 保留模块，收缩相应职责和接口 |
| Module 全部职责退出 | 完成依赖与数据检查后改为 `retired`，保留定义 |
| App 或 Package 的相关功能停止 | 保留对象定义，准确说明职责与边界，按各 Module 的情况处理状态 |

### 功能退出与依赖处理

Feature 退出时，依据 Specification 区分退役的 Requirement 与其他功能仍需要的 Requirement，检查受影响的 Module、Interface、Scenario 和 Structure Relation。

Module 退役前须确认：

- 其他有效需求、约束或模块是否依赖它；
- 外部调用方和兼容要求是否需要保留能力；
- 历史数据访问、清理等职责是否需要继续承担。

存在保留职责时，Module 继续保持 `active`，并明确职责范围。退役时同步处理接口、关系、场景和 Diagram，有效设计不得继续依赖退役 Module 提供执行能力。

需求引用为空不足以证明 Module 可以退役。Module 退役不授权删除其管理的数据；数据保留、迁移和兼容要求须明确处理。必要迁移未完成时，关闭入口不能视为整个退出需求完成。

### 设计与检查职责

Design 判断改动的需求依据、职责边界、依赖影响和处理方案，在 Change 的 `reason` 中说明原因。State 通过 `changes / questions / feedbacks` 保存工作内容，Record 保存最终 Changes、来源汇总及真实交互。

Design postHook 和 Finalize 核对已有 App / Package / Module 是否保留、身份是否稳定、Module 的父引用是否与嵌套归属一致，以及退役状态、接口和引用是否一致。检查须比较补丁应用前后的完整对象，覆盖通过集合修改间接删除对象的情况。

可修正诊断以 `source: "check"` 写入 `feedbacks`，由 Design 修订后重新检查。不符合保留、生命周期或引用规则的 Changes 不进入最终保存。

### 阻塞与澄清

设计所需信息不完整、依赖或数据处理要求未明确时，通过 Questions 记录问题与影响，由 Clarify 保存真实答复。Design 据此修订 Changes；只有阻塞实际消除后才能清除 `isBlock` 并进入最终确认。

处理方向涉及需求变化时，先由 Specification 明确需求，再完成对应设计。用户确认与实际检查共同构成完成依据，未完成事项须保留真实状态。
