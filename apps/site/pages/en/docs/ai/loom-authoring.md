# Build a Loom with a coding agent

Give your coding agent the <a href="/downloads/0.4.0/loom-authoring.md" download>0.4.0 authoring guide (plain Markdown)</a>. It contains the complete source for a three-file npm Loom, a decision table, the build and install sequence and a check on the delivered bytes. Attach the file if your agent cannot fetch URLs.

## Give it a task

> Use the attached IntLoom 0.4.0 authoring guide to build a Loom that saves a supplied message as report.txt. Example input is `{"message":"First delivery"}`. The exported UTF-8 file must contain that text and a trailing newline. Choose an entry and explain why. Return the source, an installable archive, the invocation and the result of testing it in a separate consumer directory.

Replace the task, input and acceptance check with your own. For a required approval stage, say who makes the decision and what should happen on rejection. For a model-backed task, provide the available model capabilities. The host supplies credentials. For an agent that needs to **run an existing Loom**, [connect it as an MCP client](../use/mcp).
