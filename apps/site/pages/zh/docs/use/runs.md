# 使用者 CLI 指南

[安装 @intloom/meeting-notes](../start/run) 后，在交互终端输入 `intloom` 可以浏览包和最近的运行。已经知道要做什么时，可直接用下面的命令。

| 我想做什么 | 命令 |
| --- | --- |
| 看这个包需要哪些输入 | `intloom run @intloom/meeting-notes` |
| 整理 UTF-8 会议原文 | `intloom run @intloom/meeting-notes summarize --files ./notes.md` |
| 关掉终端后找回上次的工作 | `intloom status` |
| 持续查看进度 | `intloom status RUN_ID --watch` |
| 回答问题 | `intloom interaction list --run RUN_ID`，然后 `intloom interaction respond REQUEST_ID` |
| 把交付文件保存到当前目录 | `intloom artifact list --run RUN_ID`，然后 `intloom artifact export ARTIFACT_ID --out ./meeting-notes.md` |
| 取消进行中的工作 | `intloom run stop RUN_ID` |

把大写编号替换成屏幕上实际的值。观察时按 Ctrl+C 可以退出查看，运行会继续。较长的 JSON 输入可以写进文件，用 `--input @input.json` 读入。脚本需要读取 JSON 结果时，加 `--plain`。[回答问题与确认交付](./review) · [命令参考](../reference/cli)
