# Specification Stage 设计

本文定义 Specification 的需求模型、修改规则、澄清确认和结果生成逻辑。公共约定见 [Stage 数据与文档约定](../README.md)，流程声明见 [specification.yaml](../../../workflows/stages/specification.yaml)。

## 1. 目标与产物

Specification 将本轮用户 Intent 转换为清晰、稳定、可验收的需求变化，负责需求分析、澄清、确认和正式需求生成。

| 产物 | 业务含义 |
| --- | --- |
| Specification Artifact | 应用本轮变化后的完整需求，作为项目正式需求依据 |
| Specification Record | 本轮原始 Intent、来源引用、最终确认的变化及原因、真实问答和反馈 |

数据结构见 [artifact.ts](./artifact.ts)、[state.ts](./state.ts) 和 [record.ts](./record.ts)。示例入口：[Todo Artifact](./example/todo.artifact.ts)、[Intents](./example/todo.intents.ts) 和 [Records](./example/todo.records.ts)。

## 2. 需求模型

| 对象 | 业务含义与关系 |
| --- | --- |
| Domain | 领域的业务责任边界 |
| Feature | 所属 Domain 内的功能目标与职责 |
| Requirement | 所属 Feature 的行为要求，包含条件、结果与验收含义 |
| Acceptance | 某条 Requirement 的具体验收条件，保存在其 `acceptances` 中，`requirement_ref` 指向所属 Requirement |
| Constraint | 跨功能或全局必须遵守的要求，如可靠性、安全性、性能目标 |
| Relation | 两条 Requirement 之间的依赖关系、成立条件及影响，不重复需求正文 |
| Deferred | 可暂缓的待决问题，保留问题、背景、影响及受影响的 Feature / Requirement / Constraint 引用 |

Domain、Feature、Requirement、Constraint、Relation、Deferred 按集合保存，通过稳定 ID 关联。Acceptance 有独立 ID，其完整结构为 `id / requirement_ref / description`；父引用必须与实际所属 Requirement 的 ID 一致。Artifact 与 State / Record 的完整对象补丁使用同一结构。

七类对象的 ID 前缀依次为 `SDOM-* / SFEA-* / SREQ-* / SACC-* / SCON-* / SREL-* / SDEF-*`。除 Acceptance 外均有 `status: active / retired`；Acceptance 的生命周期由所属集合中的存在与移除表达。

Relation 的 `depends_on` 表示 source 成立依赖 target，`conflicts_with` 表示两者在相同条件下不能同时成立且语义对称，`refines` 表示 source 对 target 的细化。引用必须对应实际对象，关系正文说明成立条件和业务影响。

需求对象只包含类型声明的字段；可选字段无内容时省略，空集合使用 `[]`，不以 `null` 占位。正文字符串须含非空白内容。

## 3. 需求变化

### 分析范围与累计变化

Analyze 首次执行时初始化 State，设置本轮 `id: RUN_ID` 与原始 `intent`，理解需求并将修改记入 Changes；回环时继续修订。分析结果只写入 State。

State 包含 `id / intent / changes / questions / feedbacks`。涉及的领域与功能通过 Artifact 和本轮变化确定。Record 顶层的 `origin_refs` 汇总本轮变动涉及的来源对象，使用一维、无序、去重的 ID 列表。

`State.changes` 保存本轮待执行的修改；澄清、反馈和修正持续更新它，用户确认后由 Finalize 应用到 Artifact。`Record.changes` 保存本轮已执行的修改。

### Changes 契约

State 与 Record 共用以下结构：

| 字段 | 含义 |
| --- | --- |
| `target_ref` | 单个 Domain / Feature / Requirement / Acceptance / Constraint / Relation / Deferred ID，定位本条修改的对象 |
| `reason` | 变更原因和需要关注的影响 |
| `patch` | 相对目标对象的 JSON Patch，仅使用 `test`、`add`、`replace`、`remove` |

补丁规则：

- `path: ""` 表示目标对象本身，`/description` 等路径表示目标字段。`test` 核对旧值，不修改数据；`replace` / `remove` 前须紧接同路径的旧值 `test`。
- 新对象使用空路径 `add`，值为完整对象，ID 不能已存在。新增可选字段使用 `add`，不能借此覆盖已有字段。
- 根对象保留身份，通过 `status: active → retired` 表达退役；不允许修改已有 ID，也不允许用空路径替换或删除根对象。
- 普通引用数组可用字段级 `test + replace`；有身份的对象通过 ID 定位。每条 Change 的补丁作用于其 `target_ref` 指定的一个对象，Changes 按列表顺序应用。
- 每项 `patch` 非空且有实际变化；没有需求变化时 `changes` 可为 `[]`。补丁值必须是合法 JSON，具体字段仍须满足目标类型。
- `record_refs` 不接受直接字段补丁，由结果生成逻辑维护。

Acceptance 的专有规则：

- 补丁应用到所属 `Requirement.acceptances[]`。已有 Acceptance 通过 ID 查找，并核对 `requirement_ref` 与所属 Requirement 一致；新增 Acceptance 根据完整对象中的 `requirement_ref` 定位父要求。父要求必须存在且有效。
- 移除时先 `test` 完整验收对象，再空路径 `remove`，其 ID 不复用。
- 已有验收集合不整体替换，也不按数组下标修改。
- 随完整 Requirement 一起创建的验收，由该 Requirement 的新增补丁统一保存。

## 4. 澄清与确认

### 问题、回答与反馈

Analyze 创建 Questions。Clarify 的 postHook 将真实回答写入 `questions`，Confirm 的 postHook 将真实反馈写入 `feedbacks`，来源为 `user`；确定性检查诊断使用来源 `check`。Analyze 吸收这些信息并修订需求变化。问题保留选项、实际回答和处理标记；选项选择展开为可读正文，未回答时不编造内容。

| 标记 | 业务含义 | 处理要求 |
| --- | --- | --- |
| `questions.isSolved` | 问题在本轮是否处理完成 | 吸收回答，或将允许暂缓的未回答问题纳入 Deferred 变化后，标记为 `true` |
| `questions.isBlock` | 是否仍阻塞本轮需求成立 | 只有阻塞实际消除后才能清除 |

Feedback 通过 `source / content` 保留反馈来源与原文。是否处理完成，以修订内容和再次检查的结果为依据。

允许暂缓的未回答问题由 Analyze 纳入累计 Changes，最终进入 Artifact 的 `deferreds`，保留问题、背景和影响。仍阻塞本轮需求成立的问题必须继续澄清，不能靠转入 Deferred 绕过阻塞；`isSolved = true` 表示本轮处理完成，不代表待决问题已有业务答案。

### 分析结果与确认条件

| Analyze Outcome | 业务含义 | 后续处理 |
| --- | --- | --- |
| `clarification_required` | 仍缺少真实用户信息 | 进入 Clarify，取得回答后继续 Analyze |
| `repair_required` | 需求变化存在可修正问题 | 诊断写入 `feedbacks`（`source: "check"`），重新 Analyze |
| `ready` | 需求变化已明确，具备最终确认条件 | 进入 Confirm |

进入最终确认前，所有问题必须满足 `isSolved = true` 且 `isBlock = false`，用户反馈已纳入本轮处理，确定性问题经重新校验已消除。

用户确认的是累计 Changes 所表达的本轮需求变化。收到反馈后，Analyze 吸收反馈并重新修订、确认；用户确认后进入 Finalize。

YAML 路径为 `analyze → clarify → analyze`、`analyze.repair_required → analyze`、`analyze → confirm`、`confirm.feedback → analyze` 和 `confirm.confirmed → finalize`。类型、引用和补丁校验由业务 Code / Hook 执行。

## 5. 结果生成

### 最终检查与补丁应用

Finalize 完成以下业务检查与保存：

1. 复核已确认 Changes 与最终 State，确认问题和反馈均已处理。
2. 读取当前 Artifact，在副本上按顺序应用已确认 Changes。
3. 生成本轮 Record，以 State 的 `id` 作为 Record 的 `id`，维护来源引用，并校验完整结果。
4. 先保存更新后的 Artifact，再保存本轮 Record；两者成功后清理 State。

补丁应用或校验失败时丢弃副本，不写入正式 Artifact。两份结果均保存成功后才返回 `complete`。

### 来源维护

具有 `record_refs` 的新对象先提供 `[]`。Finalize 对实质变化的 Requirement、Constraint、Relation、Deferred 去重追加本轮 `RUN_ID`；Acceptance 变化计入所属 Requirement。Domain、Feature 不增加此字段。保存重试复用本轮 ID 和已确定的产物内容。

### Record 内容筛选

| 内容 | 保存规则 |
| --- | --- |
| `id / intent` | 保留本轮 `RUN_ID` 与原始 Intent；澄清回答和反馈不改写原始 Intent |
| `origin_refs` | 汇总本轮变动涉及的来源对象 ID；去重保存，没有来源对象时使用 `[]` |
| Changes | 保留最终确认的累计补丁及原因，包括 Deferred 的新增或修改 |
| Questions | 只保存实际已回答的问题：`id`、`question`、可选 `description` 和必填 `answer` 正文；不保存 `options`、`isBlock`、`isSolved` |
| Feedbacks | 保存本轮已处理的用户与 Check 反馈，条目含 `source / content` |

未回答的问题不进入 Record 的 `questions`。用户明确答复“暂缓”时可以保留这份真实答复，但不能用系统的暂缓处理说明填充答案。Record 由上述业务内容生成，不直接保存整个 State。

Record 的 `questions / feedbacks` 为一维列表，按上表筛选内容，不按交互批次额外分组。
