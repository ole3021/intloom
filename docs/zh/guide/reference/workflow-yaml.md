---
title: Loom 定义参考
---

# Loom 定义参考

Loom 的顶层定义放在 `package.json.loom`，Stage 定义放在各自 YAML 文件中。不存在单独的 `loom.yaml`。定义中的未知字段、重复键和保留名称会被拒绝。

```json
{
  "name": "review-loom",
  "version": "0.1.0",
  "type": "module",
  "loom": {
    "type": "loom",
    "version": "2026-10-14",
    "name": "review",
    "inputs": ["prompt"],
    "entry": "review",
    "stages": {
      "review": {
        "stage": "./stages/review/stage.yaml",
        "on": {"complete": {"end": true}}
      }
    }
  }
}
```

`loom.name` 是注册名称，`inputs` 从固定的 `prompt`、`files`、`dirs`、`urls` 中选择，每个已声明输入都必需。`exclusive` 可选；`entry` 指定 Stage key。包版本和 Loom 协议版本相互独立。

```yaml
stage:
  name: review
  state:
    schema: "./schema/state.ts"
    initialize: "./code/initialize.ts"
  entry: check
  steps:
    check:
      type: code
      code: "./code/check.ts"
      on:
        complete:
          end: true
```

`stage.name` 必须匹配顶层 key。Code Step 必需 `type`、`code`、`on`；Agent Step 必需 `type`、`agent`、`llm`、`outputSchema`、`on`，`skills` 和 `tools` 默认空数组。`llm` 为 `thinking`、`working` 或 `coding`。

路由只能是 `{ target: KEY }` 或 `{ end: true }`。Step 结束的 outcome 继续匹配该 Stage 在 `loom.stages` 中的 `on`。入口、目标和结束映射必须存在；允许循环，不可达节点产生警告。

## 资源引用

| Reference | Resource |
| --- | --- |
| `./stages/review/stage.yaml` | Stage YAML |
| `./agent/reviewer.md` | Agent Markdown |
| `./skill/review/SKILL.md` | Skill Markdown and directory assets |
| `./code/check.ts` | TypeScript default export |
| `./schema/state.ts#stateSchema` | Named Schema export |
| `./tool/draft.ts#readDraft` | Named Tool export |

路径相对声明它的文件解析，类型来自字段而非目录名。允许包内 `../` 引用共享 `src`，禁止越出包目录、反斜杠和 `.d.ts` 资源。TypeScript 使用 `#exportName`；YAML/Markdown 不使用导出选择器。支持本地模块再导出。

Agent/Skill frontmatter 只包含 `name`、`description`，正文描述角色或能力。Stage 绑定模型类型、Schema、Tools 和 Skills。Skill 附件路径在产物中相对入口定位；私有环境文件和附件符号链接会被拒绝。

构建会生成独立发布清单和三个具名导出，参见[Compiler](./compiler.md)及[完整示例](../development/create.md)。
