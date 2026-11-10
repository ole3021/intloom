# Connect an MCP client

Use an MCP client when you want to discover installed Looms, submit work and read results inside your agent environment. First [set up the service](../start/setup) and install a Loom with the CLI. The client and CLI inspect the same Runs across projects.

## Connect over HTTP

Start `intloom startup`. Configure your client's Streamable HTTP transport with `http://127.0.0.1:7341/mcp` and `Authorization: Bearer <token>`, using the value stored in `~/.intloom/token`. `intloom status` shows the actual URL and token-file path. The endpoint is loopback-only; CLI and MCP share one service per user.

There is no separate `intloom mcp` command. To use another port, use `intloom startup --port N`, or set `service.port` in `~/.intloom/intloom.yaml` and restart. `intloom shutdown` previews unfinished Runs and requires confirmation before cancelling them and closing both interfaces. Disconnecting a client does not stop a Run.

Pass an optional absolute `directory` to `intloom_run_create` for project discovery. The nearest ancestor `intloom.yaml` defines the project. Npm Loom runs and deliveries are recorded user-wide. For compiled-artifact packages with project storage, the service needs the detected project.

## Submit your first task

Use a client that negotiates protocol `2026-07-28`. Call `intloom_looms_list`, then `intloom_loom_get` for the input schema and complete reference. Send that reference and your input to `intloom_run_create`, then explicitly call `intloom_run_start` with the returned Run ID. Query `intloom_run_result` when finished.

For a waiting review, list the interactions and explicitly request a form with `intloom_interaction_prompt`. A client without suitable forms can display the question and the CLI fallback. [MCP tools and resources](../reference/mcp)
