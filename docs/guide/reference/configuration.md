---
title: Configuration reference
---

# Configuration reference

See [Loom Package 0.10](./loom-package.md) for JSON input, formal output, model profiles, named interactions and new/check/inspect commands. Legacy calls and configuration remain supported.


`intloom.yaml` uses a strict top-level Schema. Unknown fields are rejected.

## Project fields

| Field | Contract |
| --- | --- |
| `looms` | Optional array of unique package declarations: name, exact semver, 64-character lowercase sha256, optional local source |
| `localStorage` | Optional `file` or `sqlite` |
| `useMcpAgent` | Boolean, default true; external MCP executor preference |
| `mirror.enabled` | Boolean, default false |
| `mirror.files.include/exclude` | Optional arrays of nonempty file rules |
| `llms.default` | Required inside supplied llms |
| `llms.thinking/working/coding` | Optional complete role-specific model definitions |

CLI maintains installed Loom declarations. Use package management rather than inventing archive hashes.

## Model definition

`provider` is `anthropic` or `openai-compatible`; `model` is a nonempty string. `secret` is `ENV.NAME` or `DENV.NAME`, where NAME matches an uppercase environment identifier. Optional `baseURL` is a URL.

`ENV.NAME`: defined `process.env` values take precedence; undefined variables fall back only to the selected project's regular `.env`. Empty/encrypted values fail preparation. `DENV.NAME`: externally decrypted startup environment only. Restart after `.env` edits; there is no directory search, dotenv variant loading, variable expansion, internal decryption or global environment mutation.

`parameters` supports numeric temperature/topP and positive integer maxOutputTokens. `providerOptions` is a provider-keyed JSON object. Roles fall back to default without partial merging.

Application preferences and business constraints belong in the Loom input prompt.

## Host observation and limits

Optional `intloom/host.json`:

```json
{
  "maxAgentSteps": 64,
  "run": {
    "maxModelCalls": 100,
    "maxDurationMs": 600000,
    "maxKnownInputTokens": 100000,
    "maxKnownOutputTokens": 20000
  },
  "prices": [{
    "modelId": "example",
    "inputPerMillion": 1,
    "outputPerMillion": 2,
    "pricingId": "local-estimate"
  }]
}
```

Limits are positive integers. Human wait time does not consume execution duration. Rates estimate USD for known usage and do not enforce a monetary ceiling or represent provider billing.

Changes apply at Service startup. See [configuration guide](../usage/configuration.md).
