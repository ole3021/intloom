---
title: Workflow YAML 参考
---

# Workflow YAML 参考

Compiler 读取 `workflow.yaml` 和引用的 Stage 文件，拒绝未知字段及重复 YAML 键。

## Workflow 字段

`workflow.name` 为注册 flowName，`exclusive` 可选，`entry` 选择 Stage key。各 `stages.KEY` 包含 `stage` 资源和 `on` outcome 路由。

## Stage 与 Step 字段

`stage.name` 与声明匹配。`state` 必须包含 Schema 和初始化器引用，`entry` 选择 Step key，`steps` 包含：

| Step 类型 | 必需字段 | 可选字段 |
| --- | --- | --- |
| Code | `type: code`、`code`、`on` | 无 |
| Agent | `type: agent`、`agent`、`llm`、`outputSchema`、`on` | `skills`、`tools` 数组，默认空 |

路由精确为 `{ target: KEY }` 或 `{ end: true }`。名称非空、没有首尾空白，不能使用保留对象键。入口与目标必须存在，outcome 精确匹配。

## 资源引用

| 引用 | 来源 |
| --- | --- |
| `@stages/review` | `stages/review.yaml` |
| `@agents/reviewer` | `agents/reviewer.md` |
| `@skills/review` | `skills/review/SKILL.md` |
| `@codes/check` | `codes/check.ts` 默认导出 |
| `@schemas/state` | `schemas/state.ts` 默认导出 |
| `@initializers/state` | `initializers/state.ts` 默认导出 |
| `@tools/draft:readDraft` | `tools/draft.ts` 命名导出 |

支持嵌套目录。TypeScript 引用允许 `:exportName`，Stage/Agent/Skill 不允许。引用必须位于资源目录内，不允许目录穿越、反斜杠或声明源文件。它们是 Compiler 引用，不是 TypeScript import alias。

Agent/Skill Markdown frontmatter 要求 name 和 description。TypeScript 相对源导入使用 .ts，编译后改写为 .js。

## 产物元数据

```json
{
  "intloom": {"type": "workflow", "version": "2026-10-08"}
}
```

完整 ESM 清单导出生成 JS/声明及 `./package.json`。命名生成导出为 `blueprint`、`codes`、`agentSpecs`。参见[完整开发示例](../development/create.md)。
