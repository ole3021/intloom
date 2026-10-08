---
title: Stages, Steps, and routing
description: Define state initialization and explicit outcome routes for compiled workflows.
---

# Stages, Steps, and routing

Source YAML defines two routing levels. A Step routes to another Step or ends its Stage. The Stage then routes to another Stage or ends the Workflow.

## Route outcomes explicitly

```yaml
stage:
  name: review
  state:
    schema: "@schemas/review"
    initialize: "@initializers/review"
  entry: check
  steps:
    check:
      type: code
      code: "@codes/check"
      on:
        revise:
          target: revise
        accepted:
          end: true
    revise:
      type: code
      code: "@codes/revise"
      on:
        complete:
          target: check
```

This definition requires the referenced modules. Its enclosing Workflow must handle `accepted` in the route for this Stage. `complete` is a convention used by some packages, not an implicit success route.

An execution returning `{ outcome: "revise" }` moves to the named Step. Returning `{ outcome: "accepted" }` ends the Stage with that outcome. An unhandled outcome fails the Run; an exception also fails execution rather than selecting a route automatically.

## State lifecycle

On Stage entry, the initializer receives `{ runId, flowName, stageName, intent }`. Its result is validated by the Stage's Schema and becomes current business State. Each Stage owns its own initialized value; leaving a Stage releases access to it.

Read earlier formal results through Storage when a later Stage needs them. There is no automatic merge of the previous Stage's draft into the next Stage. Clearing State does not trigger automatic reinitialization.

## Agent Steps

```yaml
review:
  type: agent
  agent: "@agents/reviewer"
  llm: review
  outputSchema: "@schemas/review-result"
  tools:
    - "@tools/review:readDraft"
  skills:
    - "@skills/review"
  on:
    accepted:
      end: true
    revise:
      target: revise
```

The Agent's final output Schema must parse to a valid Step result. Store analysis and proposals through business Tools; keep final output to the routing outcome. The `llm` role selects project configuration for service execution and remains part of the task description for client execution.

## Concurrency and loops

Set `workflow.exclusive: true` for project-writing workflows that must not overlap another active Run in the same host. The exclusion includes human and Agent waits. It does not prevent independent external editors from changing files.

Routes may form loops. Define business repair budgets in State and enforce them in Code; the topology does not provide an automatic semantic termination guarantee. Validate assumptions again after user waits or external operations where upstream data may have changed.

See [YAML reference](../reference/workflow-yaml.md) for fields and [Execution resources](./execution.md) for Code and Agent contracts.
