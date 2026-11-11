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

For a Studio launched from Finder, put the key in `~/.intloom/.env`. Use the variable name from the model's `credentialRef`. For example, `env:OPENAI_API_KEY` reads a line named `OPENAI_API_KEY`. On macOS, the following opens the global credential file with owner-only permissions:

```sh
mkdir -p ~/.intloom
touch ~/.intloom/.env
chmod 600 ~/.intloom/.env
nano ~/.intloom/.env
```

In the editor, enter `OPENAI_API_KEY=your-key` with your actual value, then save. The service checks its process environment first, followed by the Run project's `.env` and the global `.env`. File edits take effect at the next start. A variable already set in the service process takes precedence until you change that environment and restart the service.

Kernel validates the input contract at creation. At start it checks referenced input files, required model and tool bindings, model capabilities and configured credentials before it records a running command. Provider authentication is checked on the actual request. The Mastra adapter reports an HTTP 401 or 403 as `MODEL_AUTH_FAILED` immediately. A timeout has its own error and retry policy.

The model must support the capabilities requested by the Loom. Use `harness: opencode` for OpenCode 2.x with a supported OpenAI-compatible chat route and its executable on the service PATH. Existing waiting Runs keep their original Harness binding. A project config can override user settings. For binding precedence and supported provider options, see the [Kernel model contract](kernel.md#model-and-tool-bindings).

For long transcripts with Qwen3.8 Flash on OpenCode Zen, the following project `intloom.yaml` uses Mastra and turns off thinking for the meeting editor. It inherits the user's configured default profile. Match the binding key to the installed meeting-notes version and set the named credential in the service environment or its `.env` file.

```yaml
version: 1
harness: mastra
models:
  meeting-editor:
    provider: alibaba
    model: qwen3.8-flash
    credentialRef: env:OPENCODE_API_KEY
    options:
      baseUrl: https://opencode.ai/inference/openai/v1
      reasoningEffort: none
bindings:
  "@intloom/meeting-notes@1.0.1":
    editor: meeting-editor
```

The global `service.port` setting controls the local MCP HTTP listener (default 7341). Use `intloom status` for the actual service details. [MCP client setup](mcp.md)

Studio and the CLI use one per-user service under `~/.intloom` from every launch directory. Each Run carries its own project directory. The first global npm operation records its npm root in `~/.intloom/npm-root`. Subsequent global installations and service restarts use that root.

For a Mastra model, optional `options.requestTimeoutMs` (default 300000) and `options.totalTimeoutMs` (default 480000) bound each provider request and the model invocation's request budget. A timeout can retry the same request once after three seconds when time remains. Cancellation ends the request or retry delay. CLI observation and Studio Run details show each attempt. A final timeout is reported as `MODEL_REQUEST_TIMEOUT`.
