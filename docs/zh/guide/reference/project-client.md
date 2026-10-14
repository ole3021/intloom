---
title: ProjectClient 参考
---

# ProjectClient 参考

`@intloom/cli` 导出可信本地 Node.js 客户端，连接运行中的 Service，不管理 Run 的生命周期。

```ts
import { connectProject } from "@intloom/cli";

const client = await connectProject("/absolute/path/to/project");
try {
  console.log(await client.listWorkflows());
} finally {
  await client.close();
}
```

## 方法

| 方法 | 结果 |
| --- | --- |
| flow(flowName, intent) | 等待或终态 Run |
| getRun(runId) | 当前快照 |
| listRuns(flowName?) | 当前实例 Run |
| listWorkflows() | 已加载定义 |
| answerAsk(runId, actionId, answer) | 继续后的 Run |
| cancelRun(runId) | 终态快照 |
| getRecord(recordId) | Record 或 null |
| getArtifact(selector) | Artifact 或 null |
| listArtifacts(query?) | 元数据分页 |
| close() | 幂等释放连接 |

Artifact 选择器为 `{ artifactId }` 或 `{ flowName, stageName }`。列表查询支持 flowName、stageName、limit、cursor。

## 明确后端集成

`discoverProjectConnection(projectRoot, "studio")` 配合 `connectProjectClient(connection)` 选择 Studio 后端入口策略，使用 Service 模型。该 API 不提供完整 Studio UI。

`ProjectConnection` 包含 url 和私有 token，属于可信后端，不放入浏览器代码。`ProjectClientOptions.requestId` 用于日志关联，不是执行去重。

外部 Agent 所有权操作使用 [MCP](./mcp.md)，不是这些方法。关闭连接保留 Run。错误包括 PROJECT_CONNECTION_FAILED、PROJECT_REQUEST_FAILED、PROJECT_RESPONSE_INVALID、PROJECT_CLIENT_CLOSED。请求不会自动重放。
