# loom.yaml fields

The public manifest belongs to the npm Loom. npm identity and version come from `package.json`.

| Field | Contract |
| --- | --- |
| `name`, `description` | Required display name and summary. |
| `commands` | A nonempty map. Each command needs `description`, relative `entry`, an `input` JSON Schema object and a human-readable `output`. |
| `defaultCommand` | Required for multiple commands. Must name one of the commands. |
| `models` | Each slot declares `strength` and `capabilities`. Supported capabilities are `tool_use` and `structured_output`. Requirements apply package-wide. |
| `looms` | Child npm package names and compatible version ranges. |
| `permissions`, `confirmations` | Declared permissions and named descriptions of business confirmation points. Implement the required checks and waits in the command. |
| `examples`, `check` | Optional JSON examples and a package-relative module for runtime preflight. |

See [the author project](../develop/project) and [host settings](./configuration).
