# 宿主配置

用户配置在 `~/.intloom/intloom.yaml`；项目的 `intloom.yaml` 可以覆盖模型设置。未声明模型需求的纯 Code 包无需凭据。运行 Agent 包时，为它配置支持相应能力的模型，并确保启动服务的进程能取得凭据。

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

由宿主选择 Harness。使用 OpenCode 时配置 `harness: opencode` 和受支持的 OpenAI 兼容聊天接口，并确保服务的 PATH 上有 OpenCode 2.x。已有等待中的运行会保留原绑定。全局配置中的 `service.port` 指定 MCP 端口，默认 7341。
