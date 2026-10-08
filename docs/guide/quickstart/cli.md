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

## Create one Run

In an interactive terminal:

```sh
intloom flow
```

Choose a Workflow and enter the intent. Alternatively, replace `your_flow` below with the loaded name:

```sh
intloom flow your_flow --intent "Describe the result you want"
```

Answer questions and review confirmation text. Requesting changes continues the same Run through the Workflow's feedback route. Enter inserts a newline in multiline prompts; Tab focuses submit and Enter submits. Cancelling an unsubmitted form leaves the Run waiting.

## Continue or inspect

```sh
intloom runs
intloom attach <runId>
intloom artifacts
```

Replace angle-bracket placeholders with actual IDs. `attach` continues an existing Run; `flow` creates another one.

For automation, supply both a name and nonempty intent:

```sh
intloom flow your_flow --intent-file intent.txt --json
```

JSON mode never prompts. It returns at a waiting or terminal state. A zero exit for a wait is not completion; inspect `run.status`. Use an interactive `attach`, or a client that submits the pending action's answer, to continue. See [Run management](../usage/runs.md).

If execution fails, inspect `intloom logs <runId>` and committed results before starting another Run. A timeout does not itself cancel work. Provider output truncation, invalid structured output, and Tool failures require diagnosis; see [Errors](../reference/errors.md).
