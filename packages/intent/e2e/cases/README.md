# Intent cases

Cases share the same CMD/MCP inputs. Each directory has case.yaml with an ordered intents list and knowledge.md; workspace is optional. Model overrides may be stored under models in case.yaml. IDs select cases case-insensitively, and omitted IDs select randomly.

S01 executes one Intent. M01 copies one completed Intent's workspace and formal history, then executes two additional Intents. L01 starts empty and executes all ten Intents. Every active list runs in one newly initialized project. Knowledge describes authorized decisions and later requirements; only scope introduced by the current or earlier intents is active.

Workflow model defaults, optional limits and optional acceptance live in ../config.yaml. See [suite usage](../README.md) and [generic E2E](../../../../e2e/README.md).
