# MCP tools and resources

The 0.4.0 HTTP endpoint exposes 20 fixed tools. Their exact argument schemas are available through `tools/list`. Tool names stay the same across packages. The installed manifest supplies each Loom's business input contract. [Client setup](../use/mcp)

| Operation | Tools |
| --- | --- |
| Discover | `intloom_looms_list`, `intloom_loom_get` |
| Control | `intloom_run_create`, `intloom_run_start`, `intloom_run_resume`, `intloom_run_stop` |
| Observe | `intloom_runs_list`, `intloom_run_get`, `intloom_run_result`, `intloom_run_events`, `intloom_run_activity` |
| Interact | `intloom_interactions_list`, `intloom_interaction_get`, `intloom_interaction_respond`, `intloom_interaction_prompt` |
| Read files | `intloom_artifacts_list`, `intloom_artifact_get`, `intloom_artifact_read` |
| Inspect acceptance | `intloom_acceptances_list`, `intloom_acceptance_get` |

## Files and responses

Discover immutable files with `resources/list` and read a URI of the form `intloom://artifacts/ARTIFACT_ID` with `resources/read`. For large files, use ranged `intloom_artifact_read` calls and advance by the returned length until `eof`. The CLI can export a complete file to disk.

`intloom_interaction_respond` records an agent response. A confirmed native form can record a human response. Query tools only read state. Successful tool results include `structuredContent` with `ok: true` and `data`; known operation failures carry `isError: true` and a structured error. Use CLI or SDK operations to install the package before discovering it via MCP.
