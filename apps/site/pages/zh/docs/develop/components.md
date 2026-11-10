# 开发能调用工具的 Agent

Agent 可以根据材料决定下一步。以报告作者为例，给它目标、允许使用的工具、必须核对的证据和结束条件。在 `loom.yaml` 声明所需的模型槽位：

```yaml
models:
  writer: {strength: standard, capabilities: [tool_use, structured_output]}
```

命令入口指向默认导出 `defineAgent` 的模块。用 `model: {slot: "writer"}` 选择槽位，同时定义输入输出 schema、指令、提示和工具列表。用 `generation.maxSteps` 限制工具循环；需要结构化输出时使用 `outputMode: "structured"`。

产出文件的工具在 `workDirectory(context.run)` 下写入字节，返回 `resultFile(relativePath, mediaType)`。Agent 的 `resultTool` 填这个工具的 ID，使交付使用工具真实运行的结果。声明 `tool_use` 的 Agent 可以通过内置 `askUser` 补问业务信息，回答后继续同一次运行。用[已配置模型的宿主](../reference/configuration)实际执行，导出并检查文件内容。
