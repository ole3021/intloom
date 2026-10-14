# External MCP entry

Use CLI commands to initialize, install, configure and start the project. Run doctor with --execution agent_ide. Then connect_mcp through the real CLI stdio proxy and inspect the advertised Tools.

Project setup uses these separate Tools and exact argument shapes:
- intloom_command({"args":["init"]}) initializes the supplied project; do not add a path or --project.
- seed_workspace({}) copies initial case files. This is a separate Tool, never an intloom_command argument.
- intloom_command({"args":["workflow","add",workflowArchive]}) installs the supplied source. Use add, not install, with no extra flags.
- configure_project({}) sets models and mirror. This is a separate Tool; do not use config set or a configure_project command.
- intloom_command({"args":["start"]}) starts the configured, seeded project.
- intloom_command({"args":["doctor","--execution","agent_ide"]}) checks the real entry.
- intloom_command({"args":["flows"]}) lists installed Workflows, and connect_mcp({}) discovers the public MCP Tools.

These examples describe the allowed API, not a fixed test script. Choose actions from actual receipts; each setup mutation occurs once. The runner injects project, JSON and noninteractive flags. CLI help cannot describe E2E-only Tools such as seed_workspace/configure_project. On later iterations, skip this setup and reuse the project; mcpTools supplies the discovered public input Schemas for this new user session. connect_mcp also returns them when already connected.

Use mcp_flow with the supplied flowName and the complete supplied intent exactly once. It invokes the public MCP flow Tool. Use mcp_tool for public queries and follow the same Run using observe_run or get_run. For pendingAgentCall, execute_agent_call delegates the actual task to a separate AI session, claiming it and using the host's business Tools. That worker receives task instructions/Skills/output Schema, not your user knowledge. For pendingAction, use submit_questions or submit_confirmation with your actual knowledge-based response. Never authorize confirmations through an Agent result.

Use submit_questions/submit_confirmation for human actions; these typed helpers invoke the real answer_ask protocol. Use MCP queries to inspect the formal results. This entry validates generic MCP with explicit answer_ask and does not claim native IDE-form or TUI coverage. A disconnected or failed client must not switch to service execution or replay flow.
