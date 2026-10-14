---
title: 查看、回答与取消 Run
---

# 查看、回答与取消 Run

只创建一次 Run，保留 ID，之后的操作都使用该 ID。

```sh
intloom flow intent --intent-file ./request.txt --json
intloom runs --flow intent
intloom attach RUN-example --json
intloom wait RUN-example --timeout 30000
intloom watch RUN-example
```

`wait` 默认等待到 `action_or_terminal`。`--until terminal` 会越过问题继续等待，但不替用户回答。超时和 Ctrl+C 只结束观察。`watch` 重连时对齐快照，不重新提交执行。

## 回答当前操作

阅读 `pendingAction` 并保留精确 ID。问题操作需要每个问题恰好出现一次：

```json
[
  {"questionId": "platform", "isSkipped": false, "answer": "Web"},
  {"questionId": "notes", "isSkipped": true}
]
```

使用实际 question ID，只有允许跳过的问题才能跳过。确认操作使用：

```json
{"isConfirmed": false, "feedback": "Please revise the storage requirement."}
```

```sh
intloom answer RUN-example --action ASK-example --answer-file ./answer.json
```

过期或无效回答会保留待处理操作。响应结果不确定时，先查看 Run，再决定是否重交。

## 取消与不确定写入

```sh
intloom cancel RUN-example
intloom operation OPERATION-UUID --instance INSTANCE-ID --json
```

取消会进入 `failed` 并记录 `RUN_STOPPED`，保留已提交数据和项目副作用。接收回执不确定时，使用原 operation 和 instance 查询。明确重放必须使用原参数、`--operation-id` 和 `--instance`。

Run 状态和回执结果表示不同含义，参见 [CMD 参考](../reference/cli.md)。恢复镜像后的继续执行是另一种操作，参见[镜像](./mirrors.md)。
