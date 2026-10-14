---
title: 人工交互与可恢复等待
---

# 人工交互与可恢复等待

只有 Code 可以调用 `interaction.askQuestions` 或 `interaction.confirm`。选择 outcome 前 await 返回回答。

问题请求是非空扁平列表，包含唯一 ID、文本、可选选项和 `isSkippable`。回答覆盖每个问题一次，使用非空文本或允许的跳过。拒绝时是否必须反馈等业务规则由 Workflow Code 管理。

## 支持恢复的确认

```ts
import {
  userAnswerConfirmationSchema,
  type ExecutableCode,
  type UserAnswerConfirmation,
} from "@intloom/workflow-sdk";

const finish = (answer: UserAnswerConfirmation) => ({
  outcome: answer.isConfirmed ? "confirmed" : "feedback",
});

const confirm: ExecutableCode = async (_input, access) => {
  access.signal.throwIfAborted();
  return finish(await access.interaction.confirm("Review the current draft."));
};

confirm.recover = (saved, access) => {
  access.signal.throwIfAborted();
  return finish(userAnswerConfirmationSchema.parse(saved.answer));
};

export default confirm;
```

声明 `confirmed` 和 `feedback` 两条路由。实际业务应根据已验证 State 准备显示上下文，并核验恢复与保存的操作 kind/context 匹配。

## 继续执行规则

进程内回答恢复原调用。重启后，`recover` 获得保存操作、已接受回答和新 access，无法恢复局部变量或之前副作用。等待前保存继续执行所需数据，恢复时避免重复副作用。

没有恢复入口的 Code 仍可执行，但不支持的重启等待会进入 `RUN_INTERRUPTED`。过期回答保留等待，不影响后续调用。

参见[交互契约](../reference/sdk.md)和[操作恢复](../usage/recovery.md)。
