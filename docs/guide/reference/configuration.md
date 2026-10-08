---
title: Configuration reference
description: intloom.yaml fields, model definitions, and managed package declarations.
---

# Configuration reference

Projects use `intloom.yaml`. The host reads configuration on startup; restart to apply changes. The top-level Schema is strict.

## Top-level fields

| Field | Type / default | Meaning |
| --- | --- | --- |
| `localStorage` | `file` or `sqlite`; default `file` | Formal-data backend |
| `useMcpAgent` | Boolean, default `true` | External MCP uses client Agent tasks when true; service models when false |
| `workflows` | Array; default `[]` | CLI-managed installed package declarations |
| `intent` | Required object | Current configuration includes application preferences; use `{ apps: [] }` when unused |
| `llms` | Optional object | Service model definitions; `default` required when this object exists |

Configuration loading defaults omitted `localStorage` to `file` and `workflows` to `[]`. CLI and Studio backend execution always select service models regardless of `useMcpAgent`.

## Workflow declarations

Each declaration contains:

| Field | Meaning |
| --- | --- |
| `name` | Unique npm package name |
| `version` | Resolved exact semantic version |
| `sha256` | Lowercase 64-character SHA-256 of the original distribution archive |
| `source` | Optional local archive source; the installer writes an absolute path |

Use `workflow add/remove` to manage these entries. The project archive checksum is distinct from package-publishing integrity metadata. It does not lock all transitive dependencies.

## Model definitions

`llms.default` is required for service admission. Optional complete role entries are `reasoning`, `coding`, and `review`. A missing role falls back to `default`.

| Model field | Requirement |
| --- | --- |
| `provider` | `anthropic` or `openai-compatible` |
| `model` | Nonempty provider model identifier |
| `secret` | `ENV.NAME` or `DENV.NAME`; uppercase environment variable name |
| `baseURL` | Optional valid URL for a custom provider endpoint |
| `parameters.temperature` | Optional number |
| `parameters.maxOutputTokens` | Optional positive integer |
| `parameters.topP` | Optional number |
| `providerOptions` | Optional provider-keyed object containing JSON option objects |

Provider-specific validity is not fully established by these generic fields. The service adapter validates the option-object shape; the selected provider determines supported parameter values and behavior.

Both credential prefixes read the host startup environment. The CLI does not load or decrypt dotenv files automatically. Empty values and still-encrypted ciphertext are rejected for referenced Agents.

## Application preferences

The framework's current configuration requires `intent.apps`, an array of application descriptors. This reference covers accepted fields without defining a package-specific business workflow.

| Field | Requirement |
| --- | --- |
| `name` | Required nonempty name |
| `type` | `web`, `service`, `worker`, `mobile`, `desktop`, or `mini-app` |
| `dependencies` | Optional array of `{ name, description }` technology preferences |
| `patterns` | Optional array of `{ name, description }` architectural preferences |
| `runtime` | Optional nonempty string for `service` or `worker` |
| `platforms` | Required nonempty array for `mobile`, `desktop`, and `mini-app` |

Mobile platforms: `ios`, `android`. Desktop: `macos`, `windows`, `linux`. Mini-app: `wechat`, `alipay`, `douyin`, `qq`, `baidu`.

Application preferences do not install business dependencies or replace a project's package-manager lockfile. Keep `apps: []` for framework-only use.

See [Configuration guide](../usage/configuration.md) for startup and execution selection.
