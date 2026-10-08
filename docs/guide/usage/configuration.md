---
title: Project and model configuration
description: Configure storage, execution paths, model roles, and the project service environment.
---

# Project and model configuration

New projects use `intloom.yaml` as their marker and configuration. Commands discover the nearest project above the current directory; `--project /absolute/path` selects that exact root instead.

## Start from the generated configuration

An empty project can start with:

```yaml
localStorage: file
useMcpAgent: true
workflows: []
intent:
  apps: []
```

If packages are already installed, retain their generated `workflows` entries rather than replacing them with the empty array. The `intent` object is required by the current configuration Schema; keep `apps: []` when you do not need package-specific application preferences.

Choose `file` or `sqlite` before storing formal data. Changing backends with existing data is rejected; there is no automatic migration. See [Results](./results.md) for data locations.

## Choose the Agent executor

| Entry | `useMcpAgent` | Agent executor | Project model required |
| --- | --- | --- | --- |
| CLI or trusted Studio backend entry | Either value | `service` | Yes |
| External MCP | `true` or omitted | `mcp_client` | No |
| External MCP | `false` | `service` | Yes |

The host can start without models. Admission checks happen before service execution creates a Run. The execution policy is fixed for that Run; configuration changes apply after host restart to new work, not by changing the executor of an existing Run.

## Configure model roles

```yaml
llms:
  default:
    provider: openai-compatible
    model: your-default-model
    secret: ENV.MODEL_API_KEY
    baseURL: https://your-provider.example/v1
  reasoning:
    provider: anthropic
    model: your-reasoning-model
    secret: ENV.REASONING_API_KEY
    parameters:
      maxOutputTokens: 8192
```

Replace placeholders with provider-supported settings. Agent Steps select `reasoning`, `coding`, or `review`. A missing role-specific entry falls back to `default`; a role entry is a complete model configuration, not a partial merge with `default`.

Provider support is `anthropic` or `openai-compatible`. Optional parameters are `temperature`, `maxOutputTokens`, and `topP`; provider-specific options are a provider-keyed object. A valid configuration does not guarantee that an endpoint supports the required Tools and structured outputs.

## Supply credentials at startup

`ENV.NAME` and `DENV.NAME` both resolve from the host startup environment. `DENV` is a convention for a value decrypted by an external launcher; the CLI does not decrypt it. The referenced variable must contain a nonempty decrypted value. Never store a plaintext credential in the YAML reference field.

After changing configuration or startup credentials:

```sh
intloom stop
intloom start
intloom doctor --execution cli
```

Check active Runs before stopping: only supported recovery boundaries can resume. Read [Recovery](./recovery.md) if work is waiting.

The saved connection retains the port and authentication identity across normal restarts. A running process does not reload edited YAML or inherit environment changes from a later terminal.

For all fields, see [Configuration reference](../reference/configuration.md).
