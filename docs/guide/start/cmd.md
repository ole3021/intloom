---
title: First Run with CMD
---

# First Run with CMD

Complete [installation](./installation.md), [initialization](./project.md), and [Workflow installation](./workflow.md) first. This walkthrough uses `intent`.

## Prepare service execution

Add a real provider/model configuration to the generated `intloom.yaml`, retaining its existing fields and installed Workflow declarations:

```yaml
llms:
  default:
    provider: openai-compatible
    model: your-model
    secret: ENV.MODEL_API_KEY
    baseURL: https://your-provider.example/v1
```

Replace placeholders and provide `MODEL_API_KEY` in the environment that starts the Service. [Model configuration](../usage/configuration.md) explains providers and roles.

```sh
intloom stop
intloom start
intloom doctor --execution cli
intloom looms
intloom run intent --prompt "Build a Todo app with local persistence"
```

Retain the returned Run ID. `doctor` checks readiness without calling a model; the Run receipt admits work but does not prove completion.

## Continue the same Run

```sh
intloom wait RUN-example
intloom attach RUN-example --json
```

Replace `RUN-example` with the actual ID. When `pendingAction` appears, read its complete questions or confirmation context. Save the user's answer as JSON:

```json
{"isConfirmed": true}
```

For a confirmation action, submit the file using the exact current action ID:

```sh
intloom answer RUN-example --action ASK-example --answer-file ./answer.json
intloom wait RUN-example
```

Question actions require an answer array instead; see [Run management](../usage/runs.md). Repeat observation and answering until terminal.

## Read the result

```sh
intloom artifacts --loom intent
intloom records --loom intent
intloom artifact --loom intent --stage validation
```

Read the Validation findings and check results. Follow [CMD usage](../usage/cmd.md) for scripting and [the Intent walkthrough](../intent/walkthrough.md) for the four stages.
