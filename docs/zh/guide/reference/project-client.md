---
title: ProjectClient 参考
description: 将可信 Node.js 后端连接到共享项目服务，Run 状态仍由服务管理。
---

# ProjectClient 参考

`@intloom/cli` 导出面向可信本地应用和后端集成的 Node.js 客户端，它不是浏览器 SDK。服务拥有执行职责，客户端连接不拥有其 Run 的生命周期。

## 连接本地项目

```ts
import { connectProject } from "@intloom/cli";

const client = await connectProject("/absolute/path/to/project");
try {
  const workflows = await client.listWorkflows();
  console.log(workflows);
} finally {
  await client.close();
}
```

连接前先启动服务。`connectProject` 绑定 CLI 来源。Studio 后端使用 `discoverProjectConnection(projectRoot, "studio")`，然后调用 `connectProjectClient(connection)`。这会选择服务模型策略，不包含完成的 Studio 界面。

显式 `ProjectConnection` 包含 `{ url, token }`，应保存在可信后端中。显式连接工厂不读取本地文件，传入 URL 不会改变服务仅监听回环地址的策略。

## 方法

| 方法 | 结果 |
| --- | --- |
| `flow(flowName, intent)` | 在等待或终止状态返回的新 Run 快照 |
| `getRun(runId)` | 当前 Run 快照 |
| `listRuns(flowName?)` | 当前服务的 Run 快照 |
| `listWorkflows()` | 已加载 Workflow 视图 |
| `answerAsk(runId, actionId, answer)` | 继续后的 Run |
| `cancelRun(runId)` | 终止 Run，或未变更的已有终止 Run |
| `getRecord(recordId)` | 已存储 Record 或 `null` |
| `getArtifact(selector)` | 已存储 Artifact 或 `null` |
| `listArtifacts(query?)` | 带可选游标的元数据分页 |
| `close()` | 释放客户端连接，幂等 |

`selector` 是 `{ artifactId }` 或 `{ flowName, stageName }`。公开 Artifact 列表查询接受 `flowName`、`stageName`、`limit` 和 `cursor`。根据 `RunView` 展示待处理人工操作，获取真实答案，并使用操作 ID 提交。

这些业务方法不包含客户端 Agent 任务所有权操作；外部 Agent IDE 使用 [MCP 任务协议](./mcp.md)。包安装函数是独立的本地管理 API，不是 ProjectClient 方法。

## 错误与所有权

客户端验证响应结构，并保留分类业务错误。无效响应变为 `PROJECT_RESPONSE_INVALID`，连接失败为 `PROJECT_CONNECTION_FAILED`，结果不确定的请求为 `PROJECT_REQUEST_FAILED`，关闭后使用为 `PROJECT_CLIENT_CLOSED`。

请求不会自动重放。可选 `requestId` 用于日志关联，不用于去重。连接失败后，其他客户端可以检查原来的 Run。关闭客户端不会取消 Run。

导出类型包括 `ProjectClient`、`ProjectConnection`、`ProjectClientOptions`、`RunView`、`PendingUserAction`、`RunErrorView`、`WorkflowView`、`StoredRecord`、`StoredArtifact` 和 `ListPage`。

