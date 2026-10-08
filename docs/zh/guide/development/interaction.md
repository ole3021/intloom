---
title: 人工交互与恢复
description: 实现提问、确认，以及显式支持重启的 Code 等待。
---

# 人工交互与恢复

问题和确认属于 Code Steps。Runtime 记录所属 Run、游标和操作 ID，并暂停同一次执行，直到收到有效答案。

## 提问

在 `ExecutableCode` 内：

```ts
const answers = await access.interaction.askQuestions([
  {
    id: "destination",
    question: "Where should the result be used?",
    options: [
      { id: "local", label: "Local project" },
      { id: "shared", label: "Shared service" },
    ],
    isSkippable: false,
  },
]);
```

答案包含 `questionId`，以及 `{ isSkipped: true }` 或 `{ isSkipped: false, answer: "..." }`。选择选项会解析为答案文本。Code 决定如何保存和解释答案；模型不能将人工答案作为提案的一部分提交。

## 请求确认

```ts
const answer = await access.interaction.confirm(readableProposal);
if (!answer.isConfirmed) {
  // Save any feedback in Stage State before routing back to revision.
  return { outcome: "revise" };
}
return { outcome: "confirmed" };
```

`readableProposal` 应展示用户要批准的业务结果。等待后重新验证草稿和上游依据。确认针对展示的提案，不针对其他操作可能在等待期间写入的新内容。

取消客户端表单与提交 `isConfirmed: false` 不同：取消表单会保留等待，否定答案则沿业务路由继续。

## 让等待可重启

进程内的答案会继续原函数。进程退出后，原来的 Promise 和局部变量不再存在。添加 `ExecutableCode.recover(saved, access)`，可以继续保存的交互而不重复此前的操作。

对于 State 包含 `approved: boolean` 的 Stage，仅执行确认的 Code 可以在两个入口中使用相同的后续处理：

```ts
import type {
  CodeExecutionAccess,
  ExecutableCode,
  JsonValue,
  UserAnswerConfirmation,
} from "@intloom/workflow-sdk";
import { userAnswerConfirmationSchema } from "@intloom/workflow-sdk";
import * as z from "zod";

const stateSchema = z.strictObject({ approved: z.boolean() });

async function accept(
  answer: UserAnswerConfirmation,
  access: CodeExecutionAccess<JsonValue>,
) {
  const state = stateSchema.parse(access.state.value);
  await access.state.update({ ...state, approved: answer.isConfirmed });
  return { outcome: answer.isConfirmed ? "confirmed" : "revise" };
}

const confirm: ExecutableCode = async (_input, access) =>
  accept(await access.interaction.confirm("Approve this operation?"), access);

confirm.recover = async (saved, access) => {
  if (saved.action.kind !== "user_ask_confirmation") {
    throw new Error("Unexpected recovery action.");
  }
  return accept(userAnswerConfirmationSchema.parse(saved.answer), access);
};

export default confirm;
```

真实的提案工作流还需要在等待之前，将提案身份、相关基准和足够的后续处理信息持久保存到 State。用已保存的状态和操作请求区分可能存在的多个等待。不要依赖已经丢失的局部变量，也不要重新执行原来的外部操作。

恢复接收新的访问能力和已保存的操作、答案，不意味着再次提出相同问题。没有 `recover` 的 Code 仍可执行，但服务重启后，它的待处理等待会变为 `RUN_INTERRUPTED`。见[运行恢复](../usage/recovery.md)。

