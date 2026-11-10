# 连接 MCP 客户端

如果希望在 Agent 环境中查找已安装的 Loom、提交任务和读取结果，可以使用 MCP。先[准备服务](../start/setup)，通过 CLI 安装一个 Loom。客户端和 CLI 可以查看同一服务中各项目的 Run。

## 配置 HTTP 连接

启动 `intloom startup`。客户端选择 Streamable HTTP，地址为 `http://127.0.0.1:7341/mcp`，请求头使用 `Authorization: Bearer <token>`，token 的值读取自 `~/.intloom/token`。`intloom status` 显示实际地址与令牌文件位置。服务只监听本机；CLI 与 MCP 共用当前系统用户的一个服务。

不再提供独立的 `intloom mcp` 命令。需要其他端口时，使用 `intloom startup --port N`，或在 `~/.intloom/intloom.yaml` 中设置 `service.port` 后重启。`intloom shutdown` 展示未结束的 Run 并要求确认，然后取消它们、关闭整个服务。断开客户端不会停止 Run。

`intloom_run_create` 可传入绝对路径 `directory`。服务向上查找最近的 `intloom.yaml`；npm Loom 的运行与交付统一由当前用户的服务保存。使用项目存储的编译归档需要能定位到项目。

## 提交第一个任务

选择能够协商 `2026-07-28` 协议的客户端。先调用 `intloom_looms_list`，再用 `intloom_loom_get` 取得输入 Schema 和完整包引用。把引用与输入交给 `intloom_run_create`，用返回的 Run ID 显式调用 `intloom_run_start`。运行结束后用 `intloom_run_result` 取回结果。

遇到待审核请求时，先列出交互，再显式调用 `intloom_interaction_prompt` 展示表单。客户端无法呈现对应表单时，可展示问题和备用 CLI 命令。[MCP 工具与资源参考](../reference/mcp)
