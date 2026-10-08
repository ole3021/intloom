---
title: 配置参考
description: intloom.yaml 字段、模型定义和受管理的包声明。
---

# 配置参考

项目使用 `intloom.yaml`。服务在启动时读取配置，修改后需要重启。顶层 Schema 是严格对象。

## 顶层字段

| 字段 | 类型／默认值 | 含义 |
| --- | --- | --- |
| `localStorage` | `file` 或 `sqlite`；默认 `file` | 正式数据后端 |
| `useMcpAgent` | 布尔值，默认 `true` | 外部 MCP 为 true 时使用客户端 Agent 任务，为 false 时使用服务模型 |
| `workflows` | 数组；默认 `[]` | CLI 管理的已安装包声明 |
| `intent` | 必填对象 | 当前配置包含应用偏好；未使用时保留 `{ apps: [] }` |
| `llms` | 可选对象 | 服务模型定义；该对象存在时必须包含 `default` |

配置加载时，省略的 `localStorage` 默认为 `file`，`workflows` 默认为 `[]`。无论 `useMcpAgent` 如何设置，CLI 和 Studio 后端都使用服务模型。

## Workflow 声明

每条声明包含：

| 字段 | 含义 |
| --- | --- |
| `name` | 唯一 npm 包名 |
| `version` | 解析后的精确语义版本 |
| `sha256` | 原始分发归档的 64 字符小写 SHA-256 |
| `source` | 可选的本地归档来源；安装器写入绝对路径 |

使用 `workflow add/remove` 管理这些条目。项目归档校验和与包发布的完整性元数据不同，它不会锁定所有传递依赖。

## 模型定义

服务执行准入要求 `llms.default`。可选的完整角色配置为 `reasoning`、`coding` 和 `review`。缺失角色时回退到 `default`。

| 模型字段 | 要求 |
| --- | --- |
| `provider` | `anthropic` 或 `openai-compatible` |
| `model` | 非空的提供商模型标识符 |
| `secret` | `ENV.NAME` 或 `DENV.NAME`；环境变量名为大写 |
| `baseURL` | 可选，自定义提供商端点的有效 URL |
| `parameters.temperature` | 可选数值 |
| `parameters.maxOutputTokens` | 可选正整数 |
| `parameters.topP` | 可选数值 |
| `providerOptions` | 可选，以提供商名称为键、包含 JSON 选项对象的对象 |

这些通用字段不能完整验证提供商专属参数。服务适配器验证选项对象的结构，选定提供商决定支持的参数值和行为。

两种凭据前缀都读取服务启动环境。CLI 不会自动加载或解密 dotenv 文件。相关 Agent 所需的空值或仍然加密的密文会被拒绝。

## 应用偏好

当前框架配置要求 `intent.apps`，即应用描述符数组。本参考说明接受的字段，不定义特定包的业务 Workflow。

| 字段 | 要求 |
| --- | --- |
| `name` | 必填，非空名称 |
| `type` | `web`、`service`、`worker`、`mobile`、`desktop` 或 `mini-app` |
| `dependencies` | 可选，`{ name, description }` 技术偏好数组 |
| `patterns` | 可选，`{ name, description }` 架构偏好数组 |
| `runtime` | `service` 或 `worker` 可使用的非空字符串 |
| `platforms` | `mobile`、`desktop` 和 `mini-app` 必填的非空数组 |

移动端平台：`ios`、`android`。桌面平台：`macos`、`windows`、`linux`。小程序平台：`wechat`、`alipay`、`douyin`、`qq`、`baidu`。

应用偏好不会安装业务依赖，也不会替代项目包管理器的锁文件。只使用框架时保留 `apps: []`。

启动和执行选择见[配置指南](../usage/configuration.md)。
