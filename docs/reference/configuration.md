# Configure the host

The CLI and Studio use the same per-user service. `~/.intloom/intloom.yaml` configures the user environment. A runtime project can supply its own `intloom.yaml`. `intloom init` creates a minimal project config. The author package's `loom.yaml` describes the capability.

A Code package with no model requirements runs without credentials. For a model-backed package, put a supported model description and profiles in the host configuration. Set the named credential in the environment used to start the service. For example:

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

The model must support the capabilities requested by the Loom. Use `harness: opencode` for OpenCode 2.x with a supported OpenAI-compatible chat route and its executable on the service PATH. Existing waiting Runs keep their original Harness binding. A project config can override user settings. For binding precedence and supported provider options, see the [Kernel model contract](kernel.md#model-and-tool-bindings).

The global `service.port` setting controls the local MCP HTTP listener (default 7341). Use `intloom status` for the actual service details. [MCP client setup](mcp.md)
