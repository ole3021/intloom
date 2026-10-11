---
title: Run through CLI
description: Execute a Workflow using a model configured in the project service.
---

# Run through CLI

Complete [project setup](./installation.md) and install a compatible Workflow. CLI-created Runs always select service execution, even when `useMcpAgent` is true.

## Configure the service model

Add a real provider configuration to `intloom.yaml`, preserving the generated Workflow declarations:

```yaml
llms:
  default:
    provider: openai-compatible
    model: your-model-id
    secret: ENV.MODEL_API_KEY
    baseURL: https://your-provider.example/v1
```

The values above are placeholders, not a working endpoint. Supply `MODEL_API_KEY` securely in the environment that starts the host. Put only the reference in YAML. See [Configuration](../usage/configuration.md) for model roles and provider settings.

Service execution requires `llms.default`, including Code-only Workflows. Credentials for referenced Agents are checked before Run creation. An already running host retains its original configuration and environment; restart it after changes.

## Start and inspect

```sh
intloom start
intloom doctor --execution cli
intloom flows
```

Expect the desired Workflow to be loaded and available for CLI execution. Doctor checks configuration and readiness without sending a model request; it cannot prove model compatibility or response quality.

## Create and inspect a Run

Open the persistent UI with `intloom` or `intloom tui`. Select a Workflow, enter complete multiline intent, and submit with Ctrl+Enter. TUI presents questions/options and confirmation; closing it retains pending actions.

CMD uses explicit arguments and returns admission immediately:

```sh
intloom flow your_flow --intent-file intent.txt --json
intloom wait <runId> --json
intloom attach <runId> --json
intloom answer <runId> --action <actionId> --answer-file answer.json --json
```

Normal JSON uses `ok/data/meta`. Admission is separate from completion; inspect `data.run.status`, or the `data.status` of a Run query. Answer JSON is the complete questions array or confirmation object. `wait` never submits an answer or cancels execution. See [CLI reference](../reference/cli.md) and [Run management](../usage/runs.md).

Failures can retain committed results. Inspect Run references and logs before starting another execution. Service instance statistics reset on stop/recovery; actual provider behavior requires separate acceptance.
