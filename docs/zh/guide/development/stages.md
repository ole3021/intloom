---
title: 定义阶段与路由
---

# 定义阶段与路由

在 `package.json.loom` 中定义 Loom 拓扑，在 YAML 中定义 Stage 拓扑。入口和路由目标必须在各自拓扑中存在。

```json
{
  "loom": {
    "type": "loom",
    "version": "2026-10-15",
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

Stage 内将 Code 结果路由到另一个 Step 或 Stage 结束：

```yaml
check:
  type: code
  code: "./code/check.ts"
  on:
    repair_required:
      target: revise
    complete:
      end: true
```

第二段是 `stage.steps` 的片段，需要声明 `revise` Step。Code 必须返回精确匹配的 `outcome`。Step 结束时把 outcome 交给 Stage 的 Loom 路由；缺失路由会失败，不选择默认值。

## State 生命周期

每个 Stage 声明 `state.schema` 和 `state.initialize`。初始化器接收 Run 上下文并返回 Schema 输入。State 属于一次 Stage 访问：同 Stage 的 Step 循环保留 State，重新进入 Stage 则运行新初始化器。

阶段之间通过明确正式输出传递数据，不隐式复制 State。

## Agent Step

Agent Step 声明指令、模型角色、输出 Schema、Tools 和 Skills。宿主解析最终输出，再应用返回的 outcome。模型角色使用 `thinking`、`working`、`coding`。

参见 [YAML 参考](../reference/workflow-yaml.md)和[执行资源](./execution.md)。
