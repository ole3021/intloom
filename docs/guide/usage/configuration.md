---
title: Configure projects and models
---

# Configure projects and models

Edit `intloom.yaml` while the Service is stopped, preserving installed `workflows` entries. The generated minimum is:

```yaml
localStorage: file
useMcpAgent: true
workflows: []
intent:
  apps: []
```

`intent.apps` is required by the current Schema. Keep the empty list when no application preference is needed. Choose `file` or `sqlite` before saving business data; changing a populated backend has no automatic migration.

## Configure service models

```yaml
llms:
  default:
    provider: openai-compatible
    model: your-default-model
    secret: ENV.MODEL_API_KEY
    baseURL: https://your-provider.example/v1
  review:
    provider: anthropic
    model: your-review-model
    secret: ENV.REVIEW_API_KEY
    parameters:
      maxOutputTokens: 8192
```

Providers are `anthropic` and `openai-compatible`. Steps select `reasoning`, `coding`, or `review`; omitted roles fall back to `default`. Each supplied role is a complete model configuration.

`ENV.NAME` reads `process.env` first. Only when the variable is undefined does it read the selected project root's regular `.env` file. For example, `secret: ENV.ZEN_API_KEY` can use `ZEN_API_KEY=your-key` in that project's `.env`. No parent directory, caller working directory, `.env.local` or symlink file is loaded, and file values never enter global `process.env`. Quotes, comments and multiline values follow Node's dotenv syntax; variable expansion and decryption are not performed.

Empty or still-encrypted values are rejected, including defined startup values even if `.env` contains a valid value. `DENV.NAME` requires an externally decrypted startup environment value. Restart the Service after editing `.env`; readiness and Agent assembly share the same lazy file snapshot.

```sh
intloom stop
intloom start
intloom doctor --execution cli
intloom config show --json
```

A running Service retains its startup configuration and environment. For revision-checked updates, read the revision from `config show` and pass it to `config set --file FILE --revision HASH`. The file is a complete replacement configuration.

See [all configuration fields](../reference/configuration.md) and [Service operations](./service.md).
