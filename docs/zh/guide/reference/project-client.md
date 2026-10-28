---
title: ProjectClient 参考
---

# ProjectClient 参考

新版 Loom 的 JSON 输入、正式 output、models 三档配置、命名交互及 new/check/inspect 命令见 [Loom Package 0.10](./loom-package.md)。旧调用与配置仍兼容。


`@intloom/cli` 导出可信本地 Node.js 客户端，连接运行中的 Service，不管理 Run 的生命周期。

```ts
import { connectProject } from "@intloom/cli";

const client = await connectProject("/absolute/path/to/project");
try {
  console.log(await client.listLooms());
} finally {
  await client.close();
}
```

## 方法

| 方法 | 结果 |
| --- | --- |
| run(loomName, input) | 受理后的 Run 快照 |
| getRun(runId) | 当前快照 |
| listRuns(loomName?) | 活跃 Run 与保留的终态历史 |
| listLooms() | 已加载定义 |
| answerAsk(runId, actionId, answer) | 继续后的 Run |
| cancelRun(runId) | 终态快照 |
| getRecord(recordId) | Record 或 null |
| getArtifact(selector) | Artifact 或 null |
| listArtifacts(query?) | 元数据分页 |
| close() | 幂等释放连接 |

Artifact 选择器为 `{ artifactId }` 或 `{ loomName, stageName }`。列表查询支持 loomName、stageName、limit、cursor。

## 明确后端集成

`discoverProjectConnection(projectRoot, "studio")` 配合 `connectProjectClient(connection)` 选择 Studio 后端入口策略，使用 Service 模型。该 API 不提供完整 Studio UI。

`ProjectConnection` 包含 url 和私有 token，属于可信后端，不放入浏览器代码。`ProjectClientOptions.requestId` 用于日志关联，不是执行去重。

外部 Agent 所有权操作使用 [MCP](./mcp.md)，不是这些方法。关闭连接保留 Run。错误包括 PROJECT_CONNECTION_FAILED、PROJECT_REQUEST_FAILED、PROJECT_RESPONSE_INVALID、PROJECT_CLIENT_CLOSED。请求不会自动重放。

每次变更绑定新的操作 UUID 和连接时的 Service 实例。不确定错误保留两种身份，供 `get_operation` 查询；不要通过再次提交业务操作消除不确定性。需要显式控制回执和重试身份时使用 CLI Core 或 MCP。
