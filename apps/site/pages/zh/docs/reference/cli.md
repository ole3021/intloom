# CLI 命令参考

运行已有包请看[使用者 CLI](../use/runs)，制作包请看[开发者 CLI](../develop/cli)。用 `intloom COMMAND --help` 查看对应命令的选项。下表省略开头的 `intloom`。

| 命令 | 适用范围和用途 |
| --- | --- |
| `install SOURCE [--project DIR]` | 按 npm 包名或归档安装。默认全局安装；从项目运行时优先选项目版本。 |
| `run NAME [COMMAND] [--input JSON] [--confirm-delivery]` | npm Loom 只给包名时显示用法，传入输入后运行指定命令。可请求最终交付确认。 |
| `status [RUN_ID] [--watch]` | 查看进行中和最近结束的运行，或观察指定运行。 |
| `loom list [--id ID]` · `loom describe ID` · `loom remove ID [--project DIR]` | 浏览服务目录、读取已安装包说明、移除安装。用 `loom describe FILE.tgz` 静态检查归档适用于编译归档格式。 |
| `dev init DIR --id ID` | 生成 npm Loom 作者项目。回到作者目录用 `npm run build` 构建。 |
| `dev build` · `dev test` · `dev publish --dry-run` | 构建、试跑或预览[已有编译归档项目](./compatibility)。 |
| `init [DIR]` | 创建运行项目配置。 |
| `startup [--port N]` · `shutdown` | 启动或观察用户服务，或经确认取消未结束的运行并关闭服务。 |

## 运行与交互

| 命令 | 用途 |
| --- | --- |
| `run SELECTOR [--input JSON]` | 创建、启动并观察 Run，直到等待或结束。 |
| `run create SELECTOR [--input JSON]` · `run start RUN_ID` | 将创建和启动拆成两步。 |
| `run events RUN_ID [--after SEQ] [--limit N]` | 从指定序号之后读取事件。 |
| `run stop RUN_ID [--reason TEXT]` | 请求协作式取消。 |
| `interaction list --run RUN_ID` · `interaction get REQUEST_ID` | 查找问题并查看回答历史。 |
| `interaction respond REQUEST_ID` | 在终端询问本人。使用 `--value JSON` 会提交程序回答；使用 `--action decline` 或 `--action dismiss` 后问题继续等待。 |
| `run resume RUN_ID --request REQUEST_ID` | 使用已保存的答案继续执行。 |
| `run resume RUN_ID --wait WAIT_ID [--value JSON]` | 继续指定的外部等待或子 Run 等待。子 Run 提供自己的结果。 |

## 文件与验收

| 命令 | 用途 |
| --- | --- |
| `artifact list --run RUN_ID` · `artifact get ARTIFACT_ID` | 查找文件或查看元数据。 |
| `artifact read ARTIFACT_ID` | 将文件字节写入标准输出。`--offset` 和 `--length` 可指定范围。 |
| `artifact export ARTIFACT_ID --out FILE` | 保存经过校验的副本。替换已有文件须显式加 `--overwrite`。 |
| `acceptance list --run RUN_ID` · `acceptance get ACCEPTANCE_ID` | 查看记录的候选对象、检查项与结论。 |

## 脚本调用

输入支持内联 JSON、文件 `@input.json` 或标准输入 `@-`。使用 `--plain` 时，标准输出只有一个结果对象，进度和诊断写到标准错误。分页列表可用 `--limit` 和 `--cursor`。查询操作成功时退出码为 0，即使查到的 Run 已失败。

| 退出码 | 执行或观察时的含义 |
| --- | --- |
| 0 | 执行成功，或查询、控制操作成功 |
| 1 | 失败、取消或中断 |
| 2 | 参数有误，或输入、回答校验失败 |
| 3 | 等待回应或其他继续执行的条件 |
| 4 | 观察超时 |
| 5 | 执行成功，选中的验收记录为 quality: rejected |
| 130 | 观察或交互式提示被中断 |

`status` 是全局总览，`status RUN_ID` 默认包含完整详情，不接受 `--details`。Run 向上识别 `intloom.yaml`；编译归档项目可以声明 `storage: "global" | "project"`，默认全局。要求项目存储但未找到项目时会报错。不提供 `--data-dir` 或环境变量切换实例。

`startup` 在前台观察服务；Ctrl+C 只退出观察，使用 `shutdown` 才关闭服务。`--port N` 指定 MCP 端口，端口占用或配置错误会给出修复提示。`status` 显示全部未结束 Run 和最近 10 个已结束 Run，不提供分页和筛选。`status RUN_ID --watch --timeout 30` 最多观察指定 Run 30 秒。
