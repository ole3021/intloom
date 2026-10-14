---
title: 配置项目与模型
---

# 配置项目与模型

Service 停止时编辑 `intloom.yaml`，保留已安装的 `workflows` 条目。生成的最小配置如下：

```yaml
localStorage: file
useMcpAgent: true
workflows: []
intent:
  apps: []
```

当前 Schema 要求 `intent.apps`。无需应用偏好时保留空数组。在保存业务数据之前选择 `file` 或 `sqlite`；已有数据的后端切换没有自动迁移。

## 配置服务模型

```yaml
llms:
  default:
    provider: openai-compatible
    model: your-default-model
    secret: ENV.MODEL_API_KEY
    baseURL: https://your-provider.example/v1
  review:
    provider: anthropic
    model: your-review-model
    secret: ENV.REVIEW_API_KEY
    parameters:
      maxOutputTokens: 8192
```

提供方支持 `anthropic` 和 `openai-compatible`。Step 选择 `reasoning`、`coding` 或 `review`；未配置的角色回退到 `default`。每个显式角色都是完整模型配置。

`ENV.NAME` 优先读取 `process.env`，只有变量不存在时才读取目标项目根目录的普通 `.env` 文件。例如，`secret: ENV.ZEN_API_KEY` 可以使用该项目 `.env` 中的 `ZEN_API_KEY=your-key`。不检查父目录、调用命令的工作目录、`.env.local` 或符号链接文件，也不会把文件值写入全局 `process.env`。引号、注释和多行值遵循 Node 的 dotenv 语法，不执行变量展开或解密。

空值或仍加密的值会被拒绝；环境变量已经存在但为空时，也不会改用 `.env` 中的值。`DENV.NAME` 仍要求外部解密后的启动环境值。修改 `.env` 后重启 Service；就绪检查和 Agent 创建共用同一份按需加载的文件快照。

```sh
intloom stop
intloom start
intloom doctor --execution cli
intloom config show --json
```

已有 Service 保留启动时的配置和环境。需要按版本更新时，读取 `config show` 返回的 revision，再传给 `config set --file FILE --revision HASH`。该文件应包含完整替换配置。

参见[全部配置字段](../reference/configuration.md)和 [Service 操作](./service.md)。
