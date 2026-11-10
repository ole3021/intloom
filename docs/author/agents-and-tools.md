# Give an Agent a goal and tools

Use an Agent when execution needs judgment. Tell it what evidence to inspect, which tools it can call, what question to ask when information is missing, and what observable result ends the task.

1. Declare a named model slot in `loom.yaml` with its strength and required capabilities. Use `tool_use` for tools and `structured_output` when requiring structured model output.
2. Default-export `defineAgent` in the command entry. Set its input/output schemas, instructions, prompt, model slot, output mode and tools. Bound a tool loop with `generation.maxSteps`.
3. For a file delivery, implement a tool that writes bytes into the run work directory and returns `resultFile`. Set the Agent's `resultTool` to that tool's ID so delivery uses its actual result.
4. Test with a host that has a configured model, credentials and compatible Harness. Check the tool receipt and exported file. A model response that names a file supplies no file bytes.

The [writer entry](../../test/integration/fixtures/clarification/writer.ts) and its [manifest](../../test/integration/fixtures/clarification/loom.yaml) show a tool-backed Agent. With a `tool_use` slot, the built-in `askUser` can persist a question. Answering continues the same Run on its bound Harness. [Host configuration](../reference/configuration.md)
