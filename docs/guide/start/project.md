---
title: Initialize a project
---

# Initialize a project

Create a new or empty project directory with CMD:

```sh
intloom init my-project
cd my-project
```

Initialization creates the project configuration without overwriting existing files. To set up a Workflow and Codex in one operation:

```sh
intloom init my-project --loom @intloom/intent --mcp codex
```

Use one initialization path. `--loom` is repeatable, and `--start` optionally starts the Service after setup. The output reports scaffold, Workflow installation, MCP setup, and Service startup separately. Inspect partial success before repeating setup.

## Project directories

| Path | Purpose |
| --- | --- |
| `intloom.yaml` | Project marker, Workflow declarations, models and preferences |
| `intloom/` | Formal Artifacts/Records or SQLite data; optional `host.json` |
| `.intloom/` | Installation, discovery credentials, logs, runtime checkpoints and optional mirrors |
| `.codex/config.toml` | Generated Codex MCP entry, when requested |

Commands normally discover the nearest project above the working directory. `--project /absolute/path` selects that exact project root.

Keep connection credentials private. Preserve formal data and unfinished recovery files when moving or backing up a project. Continue with [install a Workflow](./workflow.md), then choose a quick start.
