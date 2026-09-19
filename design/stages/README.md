# Stage 数据与文档约定

本文定义各 Stage 共用的数据规则、协作关系和完成约定。各阶段的 README 定义自身职责与内部逻辑，类型文件定义数据结构，YAML 声明执行流程。Kernel、Stage、Workflow 的抽象职责见 [架构文档](../architecture/stage.md)。

## 1. 阶段与产物

| Stage | 工作状态 | 正式产物 | 文档 |
| --- | --- | --- | --- |
| Specification | Intent、累计需求变化、问答和反馈 | 完整需求 Artifact、本轮 Record | [Specification](./specification/README.md) |
| Solution | 累计设计变化、问答和反馈 | 完整设计 Artifact、本轮 Record | [Solution](./solution/README.md) |
| Implementation | 代码改动和反馈 | 实际代码与测试、本轮 Record | [Implementation](./implementation/README.md) |
| Validation | 量化统计范围、逐项检查和问题 | 验证 Artifact | [Validation](./validation/README.md) |

开发流程声明见 [intent.workflow.yaml](../../workflows/intent.workflow.yaml)：

```text
Specification → Solution → Implementation → Validation
```

Specification 形成需求依据，Solution 将需求转为设计，Implementation 实现代码并确保可运行、测试通过，Validation 评估整体实现并提供反馈。后续修改或重新执行由用户发起。

各阶段通过项目资源读取正式输入。需要改变需求或设计时，先明确对应阶段的产物，再继续依赖该产物的工作。设计对象的职责、接口、协作、共同规则和架构决策由 Solution 明确；文件组织、函数拆分、具体 API / SDK 调用、非架构级依赖和测试实现由 Implementation 处理。

## 2. 运行标识与数据归属

各 Stage State 和 Record 使用 `id: RUN_ID`，格式为 `RUN-*`，标识所属 Workflow Run。一次 Run 可以经过多个 Stage，每个 Stage 在同一 Run 中最多产生一份 Record；记录通过阶段、项目资源位置和运行 ID 区分。

State 的初始化、更新与清理遵循 [Stage 数据访问](../architecture/stage.md#4-数据访问)；各阶段定义自己的字段、处理条件和完成规则。

Artifact 保存阶段的完整正式结果，Record 保存本轮变化及交互。保存后的 Artifact Revision 和 Record 不就地修改。Revision 标识、当前版本指针与持久化机制属于外层存储约定。

同时生成 Artifact 和 Record 的阶段，使用同一份最终 Changes；先保存 Artifact，再保存 Record，全部保存成功后清理 State 并报告完成。重试复用本轮 Run ID 和已确定内容，部分保存失败不得报告完成。

## 3. Questions 与 Feedbacks

Specification、Solution 使用 `questions: STATE_QUESTION_STRUCTURE[]`，保存问题、可选说明与选项、实际回答及 `isBlock / isSolved`。

没有回答时省略 `answer`，不能用 Agent 的处理说明替代用户回答。选项选择应展开为可读答复。`isSolved` 表示本轮处理完成，`isBlock` 表示问题仍阻塞阶段完成；允许暂缓的问题按所属 Stage 的业务规则处理。

Specification、Solution、Implementation 使用 `feedbacks: STATE_FEEDBACK_STRUCTURE[]`，通过 `source: "user" / "check"` 和 `content` 保留反馈来源与原文。Agent 吸收反馈并修订工作内容；Code 重新检查确定性问题。反馈是否处理完成，以修订结果和检查事实为依据。

Record 的 `feedbacks` 为一维列表，保存本轮已处理反馈。Specification、Solution Record 的 `questions` 为一维列表，只保存实际已回答的问题，条目为 `id / question / description? / answer`。

Record 按阶段规则生成，保存最终变化并筛选已处理交互。

## 4. 来源引用与补丁

`origin_refs` 是一维、无序、去重的来源对象 ID 集合。Specification、Solution 在 Record 顶层汇总本轮变动涉及的来源；Implementation 在每条代码改动中保存该项改动涉及的来源。允许引用的对象由各阶段类型限定；没有来源对象时使用 `[]`。

来源引用用于追踪改动依据，修改对象通过 `target_ref` 或代码路径定位。`reason` 或改动描述说明修改内容及原因。

Specification、Solution 的每条 Change 使用单个 `target_ref` 指向一个对象，并保存 `reason` 与 `patch`。JSON Patch 复用 `PATCH_STRUCTURE`，允许 `test / add / replace / remove`；路径相对目标对象，值须为合法 JSON。

嵌套对象中的父引用须与 Artifact 中的实际归属一致；完整对象在 Artifact、State 和 Record 中使用同一业务结构。

对象 ID 格式以模板字面量类型为准。业务校验还须核对 ID 唯一性、引用有效性、补丁可应用性和结果完整性。

## 5. 契约与执行

阶段运行需要相应 Agent、Code、Hook 和存储实现支持。类型检查验证结构，业务检查验证引用、处理规则和结果事实；运行接入与数据契约分别验证。
