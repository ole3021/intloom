---
title: Loom Apps
---

# Loom Apps

App 是交互或终态结果的可选呈现模块。Code、Agent、HTTP/MCP 调用者使用同一 Run 与业务契约。Compiler 只封装作者已构建的 HTML，不构建前端，不增加 Workflow 步骤。

## 字段和产物

```yaml
apps:
  booking:
    path: ./apps/booking
    # entry: index.html   # 默认值，相对 path
    # type: html          # 本版唯一支持类型
interactions:
  chooseRoom:
    kind: select
    title: 选择会议室
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
    title: 确认预约
    context: {$ref: ./schemas/payload.json}
    app: booking
presentation:
  result:
    app: booking
```

`app` 引用根部 App ID，自身不发起交互。执行逻辑请求命名交互，Kernel 拥有 action、回答 Schema、业务校验和续接。`acceptance` 保持独立：App 不能通过验收或生成正式 output。结果绑定覆盖成功及失败/取消；失败展示安全错误与证据引用，不宣称外部写入一定没有发生。

`choices` 是标准呈现投影，不是另一套业务规则。`itemsPath` 指向请求 context；`valuePath`、`labelPath` 相对每个候选；值须为不重复的 JSON 基础值。`responsePath` 指定选择后生成的回答字段。仍必须通过完整 Schema 和 validator。投影失效则使用 Schema/文本输入，不跳过必要决定。

首版要求自包含 HTML：脚本、样式已内联，图片等资源已嵌入。Compiler 检查可识别的外部引用、模块导入、嵌套页面、越界路径及符号链接，将目录原样复制到 `dist/apps/<id>/`，在 `definition.apps` 记录入口、MIME、SHA-256、App 协议版本。仍只有 `definition`、`plan`、`bindings` 三个导出，产物协议提升至 `2026-10-27.2`。宿主读取时检查内容哈希与 Run 的可执行产物身份。静态检查不能证明任意 JavaScript 行为；宿主仍须执行 CSP 和 iframe 隔离。

## 可选浏览器 SDK

仅使用 `/app` 的前端作者需要安装可选 peers：

```sh
bun add @intloom/loom-sdk @modelcontextprotocol/ext-apps@2.0.4 @modelcontextprotocol/client@2.3.1 @modelcontextprotocol/core@2.3.1
```

```ts
import { connectLoomApp } from "@intloom/loom-sdk/app";
const app = await connectLoomApp({name: "booking"});
app.subscribe((snapshot) => {
  // 根据 snapshot.view 的 interaction / status / result 呈现。
});
// 由真实用户操作触发，使用当前 action 和原样回答：
await app.answer(actionId, {roomId: selectedRoomId});
// 响应丢失后核实原操作，不重新提交：
await app.inspectSubmission();
await app.dispose();
```

`/app-contracts` 提供无浏览器依赖的 Zod 契约与投影工具。`/app` 使用 MCP Apps 标准初始化、tool-result 和工具调用，顺序轮询读取；忽略旧 revision，检查 Run/App/产物/服务身份，终态已静止或连接失败后停止轮询。未决提交保留原 operation ID，核实前不能提交另一回答。

## Kernel 和宿主协议

`AppBootstrap` 通过 tool-result 的 `_meta["io.intloom/app"]` 传入，包含协议版本、过期时间、`viewToken`、方法名、初始快照，不写入模型可见正文。快照包含 Run 身份、状态、revision，以及当前拥有的交互、状态/交接信息或声明的终态结果；不暴露模型凭据、全部内部 State 或任意执行工具。

| App 方法 | 职责 |
| --- | --- |
| `intloom_app_read` | 根据 view token 读取当前快照 |
| `intloom_app_answer` | 提交 token、serviceInstanceId、operationId、actionId 和原样 JSON 回答 |
| `intloom_app_operation` | 在同一 Run/App/source 下核实原操作 |

回答进入既有 Operations admission。`accepted` 代表回答被接纳，不代表预约成功；校验拒绝保留 pending action。令牌约束调用来源、Run、App 和产物身份，由宿主签发；前端不能自报另一用户身份。生产宿主负责转交真人回答，测试标记 `test_simulator`。工具 visibility 是宿主权限限制，不是真人身份认证。

令牌一小时后失效，服务重启后不再有效。重新打开原 Run 获取新视图，不调用 `run` 重新连接。操作回执属于原服务实例；重启后核对持久化 Run/interaction 证据，未知结果保持未知，不自动重放写入。刷新/关闭 UI 不取消 Run。创建、取消、恢复仍由宿主负责。

## MCP 与非 Agent 接入

MCP 宿主声明 `io.modelcontextprotocol/ui` 能力及 `text/html;profile=mcp-app`。启动一次 Run，查询 `get_run`，根据可选 `presentation.toolName` 打开该 Run 的准确资源。show 工具声明 `_meta.ui.resourceUri`，资源使用 `ui://…` 和限制性的 CSP。宿主初始化 iframe，并转交私有 bootstrap。通用执行工具只对模型开放，三个受限 App 工具只对 App 开放；不支持 App 的客户端仍得到普通 Run/action，不获得 view token。

HTTP 接入由可信后端使用既有项目认证访问 `/api/v1/studio/apps/presentation`、`/open`、`/resource`、`/read`、`/answer`、`/operation`。presentation/resource 是 GET 查询，其余 App 接口接受 POST JSON。前端 `AppBridge` 仅转发三个白名单方法，不接收项目凭据。同一 HTML 可以在没有 Agent、没有 MCP 后端的场景运行。

[会议室参考宿主](https://github.com/ole3021/intloom/tree/main/examples/meeting-room-demo) 提供 HTTP/MCP 两种后端模式、固定本地用户、两个回环源与隔离 iframe。禁用 App 或加载失败时提供标准表单、选择、确认；切换保持同一 action 和校验。这是本地参考宿主，不是多用户托管服务；具体第三方 MCP 宿主需单独验证。
