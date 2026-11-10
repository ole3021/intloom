# loom.yaml 字段参考

npm Loom 的公开命令在清单中声明。npm 包名和版本由 `package.json` 管理。

| 字段 | 契约 |
| --- | --- |
| `name`、`description` | 必填的展示名称和简介。 |
| `commands` | 至少一条命令。每条需要 `description`、相对入口路径 `entry`、JSON Schema 对象 `input` 和面向使用者的 `output` 说明。 |
| `defaultCommand` | 有多条命令时必填，必须指向已声明的命令。 |
| `models` | 每个槽位声明 `strength` 和 `capabilities`，可用能力为 `tool_use`、`structured_output`。需求按整个包检查。 |
| `looms` | 子 Loom 的 npm 包名与兼容版本范围。 |
| `permissions`、`confirmations` | 声明权限、为业务确认点命名并提供说明。实际检查和等待由命令实现。 |
| `examples`、`check` | 可选的 JSON 示例列表和相对于包的运行前置检查模块。 |

参阅[作者项目](../develop/project)和[宿主配置](./configuration)。
