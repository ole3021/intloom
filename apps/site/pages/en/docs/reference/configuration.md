# Host configuration

Use `~/.intloom/intloom.yaml` for user configuration. A project's `intloom.yaml` can override model settings. A pure Code package with no model requirements runs without credentials. For Agent packages, select a model with the required capabilities and make its credential available to the service.

```yaml
version: 1
harness: mastra
models:
  writer:
    provider: openai
    model: gpt-4.1-mini
    credentialRef: env:OPENAI_API_KEY
profiles:
  default: writer
  standard: writer
  reasoning: writer
```

The host selects the Harness. For OpenCode use `harness: opencode` with a supported OpenAI-compatible chat route and OpenCode 2.x on the service PATH. A waiting Run keeps its binding. `service.port` in the global configuration selects the MCP port (default 7341).
