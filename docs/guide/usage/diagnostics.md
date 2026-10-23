---
title: Logs and readiness checks
---

# Logs and readiness checks

Use diagnostics to identify the failing layer before changing a model, package, or Service.

```sh
intloom --version
intloom status --json
intloom doctor --execution cli --json
intloom looms --json
intloom attach RUN-example --json
intloom logs RUN-example --debug
intloom logs --service --follow
```

For external Agent execution, use `doctor --execution agent_ide`. Readiness checks inspect local prerequisites and do not call a real model.

## Read the evidence

Run logs correlate Run, Stage, Step, and execution IDs. A repeated Step gets a new execution ID; waiting and answering belong to the same call. Info shows lifecycle events; debug adds safe routing and execution summaries.

Logs can be read after Service exit. `--json` produces structured output or JSON Lines. `--info`/`--debug` diagnostics use stderr so machine stdout stays usable.

For service model failures, debug events show each request attempt, observed DNS/TCP/TLS and HTTP phases, connection reuse, stream opening, and safe HTTP status or transport codes such as `ECONNRESET`. Agents allow up to three native SDK retries before a stream opens; logs distinguish those attempts from logical model requests. An opened stream or accepted Tool is not replayed. Connection-pool events marked `initiating_context` describe the context that opened the connection; only the request's send event identifies which connection it used. Missing network phases do not establish a network fault or identify the responsible peer.

Compare `lastError`, the last cursor, pending action, operation receipt, and actual committed results. A transport failure may leave a Run active; a model failure belongs to the Run.

Logs contain safe diagnostics rather than business State or recovery instructions. They cannot reconstruct missing checkpoints. For a report, use [collect diagnostic information](../help/reporting.md).
