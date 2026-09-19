# Implementation Stage

Implementation 根据 Specification、Solution 和实际代码完成开发，确保代码可以编译、运行并通过测试，保存本轮代码改动与反馈。数据结构见 [record.ts](./record.ts)、[state.ts](./state.ts)，流程见 [implementation.yaml](../../../workflows/stages/implementation.yaml)，公共约定见 [Stage 数据与文档约定](../README.md)。

## 1. 职责与产物

| 内容 | 职责 |
| --- | --- |
| 代码、配置与测试 | 落实需求和设计，保证代码可运行、测试通过 |
| Implementation State | 保存本轮代码改动和反馈，供实现与修正使用 |
| Implementation Record | 保存最终代码改动及本轮已处理反馈 |

Implementation 交付实际项目文件与本轮 Record。文件组织、函数拆分、具体 API 调用和非架构级依赖由本阶段决定；需要改变 Solution 规定的职责、接口、协作或架构选择时，应先明确相应设计。

## 2. State 与代码改动

State 包含 `id: RUN_ID`、`changes` 和 `feedbacks`。集合无条目时使用 `[]`。

每条代码改动包含：

| 字段 | 含义 |
| --- | --- |
| `paths` | 项目相对路径列表，包含删除的文件；可选 `lines` 是 1-based 行号集合，整文件新增或删除时省略 |
| `description` | 改动内容、原因和行为影响 |
| `origin_refs` | 该项改动涉及的来源对象 ID 集合，类型为 `(SPEC_CHANGE_REFS \| SOLUTION_CHANGE_REFS)[]` |

`origin_refs` 为一维、无序、去重的列表，关联改动所依据的需求或设计对象；无来源对象时使用 `[]`。`paths` 定位实际代码变更。

路径与行号须能在代码或变更记录中定位；删除文件通过变更记录定位。行号可能指向变更前或变更后的内容，存在歧义时在 `description` 中说明。

## 3. 检查与反馈

完成代码修改后，执行适用的编译、构建、运行及测试检查。检查通过须有实际执行事实，必要检查未执行或失败时，应明确问题并完成处理。

用户反馈与 Check 诊断通过 `feedbacks` 保存 `source / content`。Implement 根据反馈修订代码，再执行必要检查；以实际代码与检查结果判断问题是否消除。

## 4. 流程与保存

```text
implement.ready → check
check.repair_required → implement
check.passed → finalize
finalize.recheck_required → check
finalize.complete → 完成阶段
```

Implement 维护代码与改动记录。Check 核对改动和引用，检查代码能否编译、运行及测试是否通过。需要修正时将诊断写入 `feedbacks`；满足实现完成条件时返回 `passed`。

Finalize 核对最终代码与已完成的检查。需要重新检查时返回 Check；满足完成条件时，提取 `id / changes` 和本轮已处理的 `feedbacks`，保存一份 Record。保存成功后清理 State 并返回 `complete`，失败不报告完成。
