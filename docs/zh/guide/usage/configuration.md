---
title: 项目与模型配置
description: 配置存储、执行方式、模型角色和项目服务环境。
---

# 项目与模型配置

新项目使用 `intloom.yaml` 作为项目标记和配置文件。命令从当前目录向上寻找最近的项目；`--project /absolute/path` 则直接选择指定的根目录。

## 从生成的配置开始

空项目可以使用以下配置启动：

```yaml
localStorage: file
useMcpAgent: true
workflows: []
intent:
  apps: []
```

如果已安装包，请保留生成的 `workflows` 条目，不要替换为空数组。当前配置 Schema 要求 `intent` 对象；不需要包特定的应用偏好时，保留 `apps: []`。

保存正式数据之前选择 `file` 或 `sqlite`。已有数据时切换后端会被拒绝，当前不提供自动迁移。数据位置见[结果](./results.md)。

## 选择 Agent 执行器

| 入口 | `useMcpAgent` | Agent 执行器 | 是否需要项目模型 |
| --- | --- | --- | --- |
| CLI 或可信 Studio 后端入口 | 任意值 | `service` | 是 |
| 外部 MCP | `true` 或省略 | `mcp_client` | 否 |
| 外部 MCP | `false` | `service` | 是 |

服务可以在未配置模型时启动。服务端执行的准入检查发生在 Run 创建之前。执行策略在 Run 创建时固定；重启服务后的新任务使用更新后的配置，已有 Run 的执行器不会因此改变。

## 配置模型角色

```yaml
llms:
  default:
    provider: openai-compatible
    model: your-default-model
    secret: ENV.MODEL_API_KEY
    baseURL: https://your-provider.example/v1
  reasoning:
    provider: anthropic
    model: your-reasoning-model
    secret: ENV.REASONING_API_KEY
    parameters:
      maxOutputTokens: 8192
```

将占位符替换为提供商支持的设置。Agent Steps 可以选择 `reasoning`、`coding` 或 `review`。没有对应角色配置时回退到 `default`；角色配置是一份完整的模型配置，不会与 `default` 进行部分合并。

支持的提供商是 `anthropic` 和 `openai-compatible`。可选参数包括 `temperature`、`maxOutputTokens` 和 `topP`，提供商专属选项使用以提供商名称为键的对象。配置有效不代表端点支持所需 Tools 和结构化输出。

## 启动时提供凭据

`ENV.NAME` 和 `DENV.NAME` 都从服务启动环境中解析。`DENV` 约定表示外部启动器解密后的值，CLI 本身不负责解密。引用的变量必须包含非空的已解密值。不要在 YAML 的凭据引用字段中保存明文密钥。

修改配置或启动凭据后：

```sh
intloom stop
intloom start
intloom doctor --execution cli
```

停止之前检查活跃 Run，只有受支持的恢复边界才能继续。如果任务正在等待，请先阅读[恢复](./recovery.md)。

正常重启会保留已保存连接的端口和认证身份。运行中的进程不会重新加载编辑后的 YAML，也不会继承后来打开的终端中的环境变化。

完整字段说明见[配置参考](../reference/configuration.md)。

