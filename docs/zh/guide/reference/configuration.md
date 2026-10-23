---
title: 配置参考
---

# 配置参考

`intloom.yaml` 使用严格顶层 Schema，未知字段会被拒绝。

## 项目字段

| 字段 | 契约 |
| --- | --- |
| `looms` | 可选唯一包声明数组：name、精确 semver、64 位小写 sha256、可选本地 source |
| `localStorage` | 可选 `file` 或 `sqlite` |
| `useMcpAgent` | 布尔，默认 true；外部 MCP 执行环境偏好 |
| `mirror.enabled` | 布尔，默认 false |
| `mirror.files.include/exclude` | 可选非空文件规则数组 |
| `llms.default` | 配置 llms 时必需 |
| `llms.thinking/working/coding` | 可选完整角色模型定义 |

CLI 维护已安装 Loom 声明，请使用包管理操作，不编造归档哈希。

## 模型定义

`provider` 为 `anthropic` 或 `openai-compatible`，`model` 为非空字符串。`secret` 为 `ENV.NAME` 或 `DENV.NAME`，NAME 满足大写环境标识符规则。可选 `baseURL` 是 URL。

`ENV.NAME`：已定义的 `process.env` 值优先，仅变量不存在时回退到目标项目的普通 `.env`；空值或加密值会导致准备失败。`DENV.NAME`：仅使用外部解密后的启动环境。修改 `.env` 后重启；不搜索其他目录、不加载 dotenv 变体、不展开变量、不内部解密、不修改全局环境。

`parameters` 支持数字 temperature/topP 和正整数 maxOutputTokens。`providerOptions` 是提供方为键的 JSON 对象。角色回退到 default，不执行局部合并。

应用偏好和业务约束通过 Loom 输入 prompt 提供。

## 宿主观察与限制

可选 `intloom/host.json`：

```json
{
  "maxAgentSteps": 64,
  "run": {
    "maxModelCalls": 100,
    "maxDurationMs": 600000,
    "maxKnownInputTokens": 100000,
    "maxKnownOutputTokens": 20000
  },
  "prices": [{
    "modelId": "example",
    "inputPerMillion": 1,
    "outputPerMillion": 2,
    "pricingId": "local-estimate"
  }]
}
```

限制为正整数。人工等待不消耗执行时长。费率按已知用量估算美元费用，不设置金额上限，也不是供应商账单。

变更在 Service 启动时生效，参见[配置指南](../usage/configuration.md)。
