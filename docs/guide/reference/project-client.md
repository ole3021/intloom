---
title: ProjectClient reference
---

# ProjectClient reference

`@intloom/cli` exports a trusted local Node.js client. It connects to an already running Service and does not own Run lifetime.

```ts
import { connectProject } from "@intloom/cli";

const client = await connectProject("/absolute/path/to/project");
try {
  console.log(await client.listWorkflows());
} finally {
  await client.close();
}
```

## Methods

| Method | Result |
| --- | --- |
| flow(flowName, intent) | Run at wait/terminal |
| getRun(runId) | Current snapshot |
| listRuns(flowName?) | Current-instance Runs |
| listWorkflows() | Loaded definitions |
| answerAsk(runId, actionId, answer) | Continued Run |
| cancelRun(runId) | Terminal snapshot |
| getRecord(recordId) | Record or null |
| getArtifact(selector) | Artifact or null |
| listArtifacts(query?) | Metadata page |
| close() | Idempotent connection release |

Artifact selectors are `{ artifactId }` or `{ flowName, stageName }`. List queries support flowName, stageName, limit and cursor.

## Explicit backend integration

`discoverProjectConnection(projectRoot, "studio")` plus `connectProjectClient(connection)` selects the Studio backend source policy, using Service models. A complete Studio UI is not supplied by this API.

`ProjectConnection` contains url and private token and belongs in the trusted backend, not browser code. `ProjectClientOptions.requestId` provides logging correlation, not execution deduplication.

External Agent ownership operations use [MCP](./mcp.md), not these methods. Connection close leaves Runs active. Errors include PROJECT_CONNECTION_FAILED, PROJECT_REQUEST_FAILED, PROJECT_RESPONSE_INVALID and PROJECT_CLIENT_CLOSED. Requests are not automatically replayed.
