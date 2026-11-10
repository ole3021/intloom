# Develop an Agent with tools

An Agent can choose the next action after looking at the data. For a report writer, give it the goal, permitted tools, evidence it needs and a completion condition. Declare a host model slot in `loom.yaml`:

```yaml
models:
  writer: {strength: standard, capabilities: [tool_use, structured_output]}
```

Point the command entry to a module default-exporting `defineAgent`. Set `model: {slot: "writer"}` and provide its input/output schemas, instructions, prompt and tools. Use `generation.maxSteps` to bound a tool loop. For structured output, select `outputMode: "structured"`.

For a file-producing tool, write the file in `workDirectory(context.run)` and return `resultFile(relativePath, mediaType)`. Name the tool in `resultTool` on the Agent so delivery uses its actual result. With a `tool_use` model slot the built-in `askUser` can pause for missing business input. The same run continues after an answer. Run a real example on a [configured host](../reference/configuration), then export the file and inspect its contents.
