---
title: Frequently asked questions
---

# Frequently asked questions

## Is IntLoom only the four-stage Intent process?

No. IntLoom executes custom Workflow definitions. The four stages belong to `@intloom/intent`. See [Workflow concepts](../concepts/workflow.md).

## Does installing the CLI install Intent?

No. Install the business package separately with `loom add`.

## Why can Service start without a model, but CMD execution fails?

Startup loads project resources. CMD/TUI service admission requires `llms.default` and startup credentials, even for a Code-only Workflow. External MCP with useMcpAgent true uses its client environment.

## Does closing TUI or MCP cancel work?

No. Explicit `cancel` controls one Run, and `stop` controls the Service.

## Why does wait return before completion?

The default stops at an action or terminal state. Answer the current action and wait again. `--until terminal` does not answer questions.

## Does completed mean the application passed every check?

No. Intent completed means the Validation report was saved. Read per-target evidence and findings.

## Where are the results?

Formal data is under `intloom/`. Query Artifacts/Records through the Service; [results](../usage/results.md) explains IDs and export.

## Why did old Runs disappear after restart?

The list is instance-local. Formal data persists; supported unfinished checkpoints can recover. There is no complete terminal history across restarts.

## Can I resume any Step after failure?

Normal recovery supports specific boundaries and Code opt-in. [Mirrors](../usage/mirrors.md) enable compatible independent paused replay, with explicit scopes.

## Can I switch storage backend?

Choose File or SQLite before data exists. Automatic migration of populated backends is not provided.

## Can I use a client other than Codex?

A compatible client can implement the generic MCP protocol. Codex is the only named adapter currently supplied; other products are not implied verified.

## Should I install Kernel for Workflow development?

No. Use SDK at runtime and Compiler at build time. Kernel is private and CLI-bundled.
