---
title: ProjectClient reference
description: Connect a trusted Node.js backend to the shared project service without owning Run state.
---

# ProjectClient reference

`@intloom/cli` exports a Node.js client for trusted local applications and backend integration. It is not a browser SDK. The host owns execution; a client connection does not own the lifetime of its Runs.

## Connect to a local project

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

Start the service before connecting. `connectProject` binds the CLI source. For a Studio backend, use `discoverProjectConnection(projectRoot, "studio")`, then `connectProjectClient(connection)`. This selects the service-model policy; a finished Studio UI is not included.

An explicit `ProjectConnection` contains `{ url, token }`. Keep it in the trusted backend. The explicit connection factory does not read local files, and passing a URL does not change the host's loopback-only service policy.

## Methods

| Method | Result |
| --- | --- |
| `flow(flowName, intent)` | New Run snapshot at a wait or terminal state |
| `getRun(runId)` | Current Run snapshot |
| `listRuns(flowName?)` | Current-host Run snapshots |
| `listWorkflows()` | Loaded Workflow views |
| `answerAsk(runId, actionId, answer)` | Continued Run |
| `cancelRun(runId)` | Terminal or unchanged terminal Run |
| `getRecord(recordId)` | Stored Record or `null` |
| `getArtifact(selector)` | Stored Artifact or `null` |
| `listArtifacts(query?)` | Metadata page with optional cursor |
| `close()` | Release the client connection; idempotent |

`selector` is `{ artifactId }` or `{ flowName, stageName }`. Public Artifact list queries accept `flowName`, `stageName`, `limit`, and `cursor`. Render pending human actions from `RunView`, collect real answers, and submit them using their action IDs.

These business methods do not include client Agent task ownership operations; external Agent IDEs use the [MCP task protocol](./mcp.md). Package installation functions are separate local administration APIs, not ProjectClient methods.

## Errors and ownership

The client validates response shapes and preserves classified business errors. Invalid responses become `PROJECT_RESPONSE_INVALID`, connection failures `PROJECT_CONNECTION_FAILED`, uncertain requests `PROJECT_REQUEST_FAILED`, and use after close `PROJECT_CLIENT_CLOSED`.

Requests are not automatically replayed. A request's optional `requestId` is log correlation, not deduplication. After a connection failure, another client can inspect the original Run. Closing a client does not cancel it.

Exported types include `ProjectClient`, `ProjectConnection`, `ProjectClientOptions`, `RunView`, `PendingUserAction`, `RunErrorView`, `WorkflowView`, `StoredRecord`, `StoredArtifact`, and `ListPage`.
