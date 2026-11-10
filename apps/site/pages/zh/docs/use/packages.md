# 管理已安装的 Loom

向作者取得 npm 包名，同时确认示例输入、预期输出和模型或软件要求。以 [@intloom/meeting-notes](../start/run) 为例，`intloom install @intloom/meeting-notes` 会安装到 npm 的全局位置，使用相同 npm 全局目录时可以从任意目录运行。

只想在一个项目里使用时，进入有 `package.json` 的 npm 项目，执行 `intloom install @intloom/meeting-notes --project .`。从这个项目执行 `intloom run @intloom/meeting-notes` 可以看到实际选中的版本和命令。项目内的版本优先于同名全局版本。`intloom loom list` 显示服务目录。

移除项目版本用 `intloom loom remove @intloom/meeting-notes --project .`，移除全局版本用 `intloom loom remove @intloom/meeting-notes`。已有交付仍可按运行编号找回。
