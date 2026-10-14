---
title: 操作项目文件与命令
---

# 操作项目文件与命令

宿主可以为 Code 或 Agent Tool 调用绑定可选 `ProjectAccess`。使用前检查是否可用。

```ts
import type { ExecutableCode } from "@intloom/workflow-sdk";

const check: ExecutableCode = async (_input, access) => {
  if (!access.project) throw new Error("Project access is required.");
  access.signal.throwIfAborted();
  const result = await access.project.run({
    command: "node",
    args: ["--version"],
    timeoutMs: 10000,
  }, access.signal);
  if (result.exitCode !== 0 || result.timedOut) {
    throw new Error("Project check failed.");
  }
  return { outcome: "complete" };
};

export default check;
```

示例以真实参数数组执行命令，并传递取消信号。结果包含 command、exitCode、stdout、stderr、timedOut、truncated。输出截断和超时应由业务验证规则处理。

## 其他操作

`snapshot` 返回文件/哈希视图，`read` 读取文本，`write` 和 `remove` 修改项目相对路径。宿主选择根目录、排除项、限制和生命周期。所有操作需要 await。

Project 能力提供可信本地操作，不构成操作系统沙箱，且与 Storage 事务原子性分开。重复 Step 可能重复文件或命令副作用。

为各 Agent 只声明需要的工程 Tools。例如 Intent 设计和验证角色使用只读 Tools，实施角色可以写入和执行命令。

参见 [SDK 参考](../reference/sdk.md)和[本地镜像](../usage/mirrors.md)。
