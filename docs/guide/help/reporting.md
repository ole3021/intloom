---
title: Collect useful diagnostic information
---

# Collect useful diagnostic information

A useful report connects a concrete action to expected behavior, actual output and the affected execution.

## Include

- Installed IntLoom and Node versions; source/development launcher if applicable.
- Interface: CMD, TUI, or named MCP client and version.
- Minimal reproduction, exact command or user action, expected and actual result.
- Project setup and relevant non-secret configuration.
- Run ID, cursor, action ID, Service instance and operation ID when available.
- Classified error, bounded logs, and actual Artifact/Record references.
- What changed before failure, whether an operation was retried, and what remains active.

```sh
intloom --version
node --version
intloom status --json
intloom doctor --execution cli --json
intloom flows --json
intloom attach RUN-example --json
intloom logs RUN-example --debug --json
```

Use agent_ide for external MCP readiness. A safe configuration projection can help, but review every exported file/log before sharing. Keep credentials, connection tokens and Agent ownerToken private; business Artifacts and mirror exports can contain sensitive project content.

## Preserve the original case

After timeout/disconnection, query the original Run. Reproducing by creating another flow can change files or obscure the original cause. Report remediation and re-verification separately from the initial failure.

[Troubleshooting](./troubleshooting.md) provides the diagnostic order.
