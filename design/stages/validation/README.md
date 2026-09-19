# Validation Stage

Validation 在 Implementation 完成后评估整体实现，保存证据、检查结果、代码问题和反馈。数据结构见 [artifact.ts](./artifact.ts)、[state.ts](./state.ts)，流程见 [validation.yaml](../../../workflows/stages/validation.yaml)，公共约定见 [Stage 数据与文档约定](../README.md)。

## 1. 职责与产物

Validation 评估需求满足程度、设计落实情况和整体实现质量，收集实际证据并保存检查、测试状态与问题反馈。

| Artifact 字段 | 内容 |
| --- | --- |
| `scope` | 可量化对象与测试代码的统计范围 |
| `specification_checks` | 需求对象、对应证据与验证结果 |
| `solution_checks` | 设计对象、对应证据与验证结果 |
| `tests_checks` | 测试定位、关联对象与执行状态 |
| `code_issues` | 重复逻辑或死代码的位置、原因及重构判断 |
| `results` | 类型定义支持的分类计数 |
| `findings` | 已确认或疑似问题、影响、位置与严重程度 |

本阶段交付评估与反馈。代码或设计的后续修改、再次运行由用户驱动；发现产品问题应如实记录，不在本阶段自动进入修正循环。

## 2. Scope：量化统计范围

| 字段 | 结构 |
| --- | --- |
| `scope.specification` | Requirement / Acceptance / Constraint / Relation 的 ID 数组 |
| `scope.solution` | 对象数组，每项含 Scenario / Concept / Decision 的 ID 数组 |
| `scope.implementation` | 对象数组，每项含 `test_code_refs: TEST_CODE[]` |

Scope 声明可量化对象与测试的统计范围。Domain、Feature 等对象可以形成定性检查结论；统计仅使用 scope 和 results 中定义的类别。

统计对象按 ID 去重。同一类别的范围须与对应检查记录一致，未完成对象保留在范围内。首次验证覆盖完整交付范围；后续验证覆盖变化及受影响的行为和相关回归，无法判断影响时扩大检查范围。

## 3. Specification Checks

每项 `specification_checks` 保存 `target / evidences / result`。

| `target.type` | 检查内容 |
| --- | --- |
| `domain` | 领域职责是否得到满足 |
| `feature` | 功能目标及相关要求是否得到实现 |
| `requirement` | 需求正文与必要验收条件是否成立 |
| `acceptance` | 具体验收条件是否满足 |
| `constraint` | 约束在适用实现中的要求是否成立 |
| `relation` | 需求间的依赖、冲突或细化关系及影响是否成立 |

Requirement 依据需求正文、验收条件及相关约束、关系影响形成结果。Domain、Feature 的整体判断不能替代具体验收，也不纳入量化统计分母。

Deferred 提供需求边界与待决事项的背景；对检查结论的影响写入 `result.reason`。尚未解决的阻塞不能判为满足。

## 4. Solution Checks

每项 `solution_checks` 保存 `target / evidences / result`。

| `target.type` | 检查内容 |
| --- | --- |
| `app` | 应用职责、边界与架构级技术约束 |
| `package` | 代码组织和分发边界 |
| `module` | 模块职责、对外接口、数据归属与生命周期约定 |
| `resource` | 逻辑资源与声明的关键能力 |
| `relation` | 结构依赖方向和协作边界 |
| `scenario` | 场景参与者、步骤与可观察结果 |
| `concept` | 共同概念的定义与规则 |
| `decision` | 设计选择是否落实 |

检查依据对象正文，证据直接关联被验证对象。Module 可以通过多份代码证据判断职责实现是否完整，以及实现是否超出职责边界。对象或同名文件存在不足以证明设计已经实现。

Interface 通过所属 Module 检查。Diagram 辅助理解设计，Risk 提供风险与明确缓解措施的背景；两者不独立计数。所有检查要求须有明确的需求或设计依据。

## 5. Evidence 与检查结果

证据保存在所属检查项的 `evidences` 中：

| 字段 | 含义 |
| --- | --- |
| `id` | `VEVD-*`，证据身份 |
| `method` | `test / runtime_observation / static_analysis / code` |
| `code_path` | 项目相对路径与可选 1-based 行号集合 |
| `target_ref` | 被验证对象的 ID，与所属检查的目标一致 |
| `result` | `fullfill / partial / violated` |
| `note?` | 证据支持的内容、发现的问题或适用限制 |

`target_ref` 支持全部 Specification / Solution 检查目标。每份证据只属于一个检查；一个检查可以包含多份证据。

四种方法分别表示执行测试并核对预期、观察实际运行、通过静态分析工具检查，以及阅读代码、配置或结构。方法须适合检查条件：交互、导航或布局需要相应测试或运行观察，静态依赖等要求可以通过代码或静态分析验证。测试源码存在不等于测试已经执行或通过。

`fullfill` 表示证据支持目标要求得到满足，`partial` 表示仅支持部分要求，`violated` 表示存在明确违反。证据的支持范围和违反内容应能通过代码位置及说明核对。

检查的 `result.status` 使用：

| 状态 | 含义 |
| --- | --- |
| `verified` | 必要条件已有充分证据支持，验证通过 |
| `partial` | 部分必要条件验证通过 |
| `undone` | 检查未完成或证据不足以形成有效判断 |
| `failed` | 至少一项必要条件已确认不成立 |

最终结果综合该目标的全部证据与必要条件。`result.reason` 说明结论依据、未完成条件和适用范围。明确违反应判为 `failed`，证据不足不能视为通过；无法执行检查也不能直接当作产品失败。

## 6. Tests 与 Code Issues

`TEST_CODE` 保存 `id: VTCD-*`、项目相对 `path`、1-based 的 `lineStart / lineEnd`。范围内的 `test_code_refs` 和检查项的 `test_code_ref` 使用同一完整结构。

每项 `tests_checks` 保存测试定位、`ttarget_refs` 与 `status`。`ttarget_refs` 关联该测试涉及的需求或设计对象，允许多个引用。

| `status` | 含义 |
| --- | --- |
| `passed` | 测试实际执行且通过 |
| `failed` | 测试实际执行且失败 |
| `not_run` | 测试未执行 |

统计范围中的测试须保存真实状态；未执行的测试保留为 `not_run`，不能当作通过或失败，也不能通过省略缩小范围。

重复逻辑与死代码使用各自的识别和统计逻辑，按相同的数据结构保存：

- `code_paths`：相关代码位置；
- `reason`：问题及维护影响；
- `needRefactor`：是否需要重构。

代码问题按具体影响评估，代码行数或测试数量不能单独证明质量。

## 7. Findings 与严重程度

Findings 保存产品或实现问题，包含 `id: VFND-*`、`status: confirmed / suspected`、`description`、可选 `impact`、`locations` 和 `severity_level`。

位置使用项目相对 `path` 与 1-based 的 `lineStart / lineEnd`。同一根因不重复记录；验证记录自身的格式、引用等错误由记录检查处理。

| 严重程度 | 判断标准 | 示例 |
| --- | --- | --- |
| `high` | 影响应用逻辑正确性，行为、计算、状态或数据处理不符合要求 | 条件判断错误、状态转换错误、数据计算或保存错误 |
| `medium` | 不影响现有逻辑正确性，但违反 Solution 设计约定，或明显增加维护、扩展与修改成本 | 职责越界、依赖方向错误、业务规则分散维护 |
| `low` | 局部风格或轻微冗余问题，对正确性、设计约定和维护成本无实质影响 | 命名或格式不一致、不影响理解与修改的少量冗余 |

同一问题符合多个级别时取最高级别。按实际影响分级：重复代码可能只是轻微冗余，也可能导致逻辑不一致。`confirmed / suspected` 表达是否证实，严重程度表达影响；疑似问题须如实说明待核实内容。

## 8. Results 与统计

Finalize 从逐项检查生成 `results`，所有计数须能由检查记录核对。

`results.specification` 为数组，每项统计 `requirement / constraint / relation / acceptance` 中一种类型。`results.solution_module` 为单个对象，统计其 `type` 指定的 `scenario / concept / decision` 类别。其他对象保留检查结论，统计以这两处声明的类别为准。

每项保存 `total_count / verified_count / partial_count / undone_count / failed_count`。同类计数使用同一 scope 范围，按目标 ID 去重；四种状态数量之和等于总数。范围内未完成检查保留 `undone`，不能通过省略对象缩小分母。

通过率可由 `verified_count / total_count` 派生；明确判定率可由 `(verified_count + failed_count) / total_count` 派生。分母为零时标记不适用，各类别分别计算，不将部分通过折算分数或合成主观总分。

## 9. 流程与 State

```text
validate.ready → check
check.valid → finalize
finalize.complete → 完成阶段
```

State 保存 `id: RUN_ID`、`scope`、`specification_checks`、`solution_checks`、`tests_checks`、`code_issues` 和 `findings`。

Validate 确定统计范围、收集证据并形成评估与反馈。Check 核对结构、引用、证据归属及记录完整性。Finalize 生成并核对汇总，保存 Artifact；保存成功后清理 State 并返回 `complete`。

检查结论为失败或发现产品问题，不妨碍有效评估记录的保存。记录校验或保存失败按执行错误处理，不报告阶段完成。阶段完成表示评估结果已交付，后续修改及重新执行由用户发起。
