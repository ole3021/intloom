# How a Loom runs

The SDK defines Code, Agent, tools and Workflow steps. The author declares public commands in `loom.yaml`. On the author's machine the Compiler produces an npm archive containing executable modules and declared resources.

The CLI installs the package and prepares its declared child Looms. From the calling project it selects an installed command. The Kernel validates input and runtime requirements, records a Run and manages interactions and delivery. The host binds a model and Harness for Agent execution. CLI and MCP clients can return to the same saved Run. [Follow one delivery](./lifecycle)
