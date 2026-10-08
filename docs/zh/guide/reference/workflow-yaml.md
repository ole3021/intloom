---
title: Workflow YAML 参考
description: 源字段、资源引用、路由、元数据和编译后的导出。
---

# Workflow YAML 参考

Compiler 从包根目录读取 `workflow.yaml`。Workflow 和 Stage 源对象是严格对象，未知字段和重复 YAML 键会被拒绝。

## Workflow 文档

| 字段 | 含义 |
| --- | --- |
| `workflow.name` | 注册的执行名称（`flowName`） |
| `workflow.exclusive` | 可选布尔值，为 true 时排除同一服务中的竞争活跃 Run |
| `workflow.entry` | 入口 Stage 键 |
| `workflow.stages.<key>.stage` | Stage 资源引用 |
| `workflow.stages.<key>.on.<outcome>` | `{ target: <stage-key> }` 或 `{ end: true }` |

## Stage 文档

| 字段 | 含义 |
| --- | --- |
| `stage.name` | 与 Workflow 声明匹配的 Stage 名称 |
| `stage.state.schema` | Zod Schema 资源引用 |
| `stage.state.initialize` | State 初始化器资源引用 |
| `stage.entry` | 入口 Step 键 |
| `stage.steps.<key>` | Code 或 Agent Step |

Code Step 包含 `type: code`、`code: <reference>` 和 `on` 路由。

Agent Step 包含 `type: agent`、`agent: <reference>`、`llm`、`outputSchema: <reference>` 和 `on` 路由。可选 `skills` 和 `tools` 数组默认为空。运行时模型角色为 `reasoning`、`coding` 和 `review`。

两种 Step 的每个 `on.<outcome>` 都是 `{ target: <step-key> }` 或 `{ end: true }`。Stage 结束时将 outcome 传到 Workflow 层路由。同一路由不能同时指定 `target` 和 `end`。

名称必须非空、没有前后空白，并避开保留对象键 `__proto__`、`prototype` 和 `constructor`。入口和目标必须能在各自拓扑中解析。

## 资源引用

| 引用 | 来源 |
| --- | --- |
| `@stages/review` | `stages/review.yaml` |
| `@agents/reviewer` | `agents/reviewer.md` |
| `@skills/review` | `skills/review/SKILL.md` |
| `@codes/check` | `codes/check.ts` 的默认导出 |
| `@schemas/state` | `schemas/state.ts` 的默认导出 |
| `@initializers/state` | `initializers/state.ts` 的默认导出 |
| `@tools/review:readDraft` | `tools/review.ts` 的命名导出 `readDraft` |

TypeScript 资源接受 `:exportName` 选择器，不指定时使用默认导出。Stage、Agent 和 Skill 引用没有导出选择器。支持嵌套资源目录。引用必须保持在资源目录内，不能使用路径穿越、反斜杠或 `.d.ts` 源文件。

这些 `@...` 值是 Compiler 的源码引用，不是 TypeScript 导入别名。相对 TypeScript 源码导入使用 `.ts`，输出导入重写为 `.js`。

## Markdown 元数据

Agent 和 Skill Markdown 以包含 `name` 和 `description` 的 YAML frontmatter 开头，正文包含指令。Step YAML 将 Agent 绑定到模型角色、Tools、Skills 和最终输出 Schema。

## 包元数据与导出

```json
{
  "type": "module",
  "intloom": {
    "type": "workflow",
    "version": "2026-10-08"
  },
  "exports": {
    ".": {
      "types": "./dist/workflow.generated.d.ts",
      "default": "./dist/workflow.generated.js"
    }
  },
  "files": ["dist"]
}
```

这段内容用于补充完整的包 manifest，其中还应包含名称、版本和运行时依赖。Compiler 验证源包的生成入口布局，输出命名的 `blueprint`、`codes` 和 `agentSpecs` 导出，不发布内部包装对象，也不在构建时实例化 Agents。

完整包示例见[创建 Workflow](../development/create.md)，构建行为见 [Compiler](./compiler.md)。

