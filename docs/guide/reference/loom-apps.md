---
title: Loom Apps
---

# Loom Apps

An App is optional presentation for a Loom interaction or terminal result. Code, Agent and HTTP/MCP callers still use the same Run and business contract. Compiler packages developer-built HTML; it does not build a frontend or add execution steps.

## Definition and artifacts

```yaml
apps:
  booking:
    path: ./apps/booking
    # entry: index.html   # default, relative to path
    # type: html          # the only supported type in this version
interactions:
  chooseRoom:
    kind: select
    title: Select a room
    context: {$ref: ./schemas/prepared.json}
    response:
      type: object
      properties:
        roomId: {type: string}
      required: [roomId]
      additionalProperties: false
    validate: ./code/validators.ts#validateRoomChoice
    app: booking
    presentation:
      choices:
        itemsPath: /rooms
        valuePath: /id
        labelPath: /name
        responsePath: /roomId
  confirmBooking:
    kind: confirm
    title: Confirm booking
    context: {$ref: ./schemas/payload.json}
    app: booking
presentation:
  result:
    app: booking
```

`app` references a root App ID. It does not request an interaction by itself. Code/Agent requests the named interaction; Kernel owns the action ID, response Schema, validator and continuation. `acceptance` remains independent: an App cannot pass checks or manufacture formal output. A result binding exposes both successful output and failed/cancelled status with safe errors and evidence references. A failed Run does not prove an external write did not happen.

`choices` is optional standard presentation, never a second business rule. `itemsPath` points into request context; `valuePath` and `labelPath` point into each item. Values must be unique JSON primitives; `responsePath` creates the selected response field. The full Schema and validator still apply. Invalid projection falls back to Schema/text input; it never skips a decision.

The first version requires self-contained HTML with bundled inline scripts/styles and embedded resources. Compiler rejects known external references, module imports, nested browsing contexts, directory escapes and symlinks. It copies the built directory unchanged to `dist/apps/<id>/` and records entry, MIME type, SHA-256 and App protocol version in `definition.apps`. The three exports remain `definition`, `plan`, `bindings`; the compiled protocol is `2026-10-27.2`. Host resource loading checks the hash and the Run's executable identity. Static checks cannot prove arbitrary JavaScript behavior; hosts also enforce a restrictive CSP and iframe isolation.

## Optional browser client

Only frontend authors using `/app` need the optional peers:

```sh
bun add @intloom/loom-sdk @modelcontextprotocol/ext-apps@2.0.4 @modelcontextprotocol/client@2.3.1 @modelcontextprotocol/core@2.3.1
```

```ts
import { connectLoomApp } from "@intloom/loom-sdk/app";
const app = await connectLoomApp({name: "booking"});
app.subscribe((snapshot) => {
  // Render snapshot.view: interaction, status, or result.
});
// On an actual user gesture, use the displayed action and exact answer:
await app.answer(actionId, {roomId: selectedRoomId});
// If the response is lost, inspect the original operation instead of replaying:
await app.inspectSubmission();
await app.dispose();
```

`/app-contracts` exports transport-neutral Zod schemas and projection helpers without browser dependencies. `/app` uses standard MCP Apps initialization, tool-result delivery and tool calls, with bounded sequential polling. It ignores older revisions, checks Run/App/artifact/service identity and stops polling on terminal settlement or connection failure. Pending submissions retain the original operation identity and block another answer until resolved.

## Kernel and host contract

`AppBootstrap` arrives in tool-result `_meta["io.intloom/app"]`, not model-visible content. It includes protocol version, an expiring `viewToken`, method names and the first snapshot. Snapshots contain Run identity/status/revision and one view: current owned interaction, status/handoff, or declared terminal result. They do not expose model credentials, full internal State or arbitrary execution tools.

| App method | Meaning |
| --- | --- |
| `intloom_app_read` | Current snapshot for the view token |
| `intloom_app_answer` | Token + serviceInstanceId + operationId + actionId + exact JSON answer |
| `intloom_app_operation` | Inspect the original operation under the same Run/App/source |

Answers go through existing Operations admission. `accepted` is an accepted answer, not a successful booking. Rejected validation keeps the pending action. Scope includes caller source, Run, App and executable identity. The host issues tokens; JavaScript cannot claim a different actor. Production hosts relay human decisions; tests explicitly use `test_simulator`. Tool visibility is a host restriction, not proof of human identity.

Tokens expire after one hour and do not survive service restart. Reopen the original Run to obtain a fresh view, never call `run` as a reconnect mechanism. Operation receipts are service-instance scoped. After restart, inspect durable Run/interaction evidence; an unknown outcome stays unknown, with no automatic write replay. UI refresh/closure does not cancel a Run. Create, cancel and resume remain host-owned.

## MCP and non-Agent flows

A compatible MCP host advertises `io.modelcontextprotocol/ui` with `text/html;profile=mcp-app`. Start a Run once, observe `get_run`, and use its optional `presentation.toolName` to open the exact resource for that Run. The show tool declares `_meta.ui.resourceUri`; resources use `ui://…` and carry restrictive CSP metadata. The host initializes the iframe and forwards its private bootstrap. Generic execution tools are model-visible; the three scoped App tools are App-only. Unsupported clients retain ordinary Run/actions without receiving a view token.

For HTTP, a trusted backend uses `/api/v1/studio/apps/presentation`, `/open`, `/resource`, `/read`, `/answer`, `/operation` with existing project authentication. Presentation/resource are GET queries; the other App endpoints accept POST JSON. A frontend `AppBridge` forwards only the three allowed App methods. Browser code never receives the project credential. The same HTML runs without an Agent or an MCP backend.

The [meeting-room reference host](https://github.com/ole3021/intloom/tree/main/examples/meeting-room-demo) supports HTTP and MCP backend modes, fixed local user context, two loopback origins and an isolated iframe. It offers standard form/select/confirm controls when App support is disabled or loading fails. Both modes retain the same action and validator. It is a local reference host, not a multi-user hosting service; compatibility with a particular third-party MCP host requires testing there.
