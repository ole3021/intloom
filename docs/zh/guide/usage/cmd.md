---
title: CMD 操作指南
---

# CMD 操作指南

CMD 适合明确操作、文件输入和脚本。执行命令接收完整参数并尽快返回；观察和回答使用独立命令。

## 输入与输出

```sh
intloom flow intent --intent-file ./request.txt --json
intloom flow intent --intent-file - --json
intloom status --json --no-color
intloom logs RUN-example --follow --json
```

stdin 示例需要把意图文本管道输入命令。`--intent` 保留完整字符串，不能与 `--intent-file` 同时使用。

不传 `--json` 时，即使重定向，CMD 也输出可读摘要和表格。`--json` 对普通操作输出一个 `CoreResult`，流式操作输出 JSON Lines。日志和诊断 stderr 与机器 stdout 分开。

## 有控制地自动化

命令是否成功看 `ok`，Run 是否完成看 `status`。接收或回答成功后，Run 仍可能运行或等待。查询失败 Run 可能返回非零退出码，成功取消则返回零。

不确定写入保留请求身份。客户端不会自动重试执行。观察器重连通过读取状态完成，不重放 `flow`。

`--project` 选择精确根目录，Artifact 导出路径仍使用终端当前目录。`--no-interactive` 禁用轻量设置选择，不会替你回答 Workflow 问题。

参见 [Run 操作](./runs.md)、[结果](./results.md)和完整[命令参考](../reference/cli.md)。
