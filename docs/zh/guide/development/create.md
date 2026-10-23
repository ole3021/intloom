---
title: 创建第一个 Loom
---

# 创建第一个 Loom

创建一个只含 Code 的 `capture` Loom，将本轮 `prompt` 保存为 Record。阶段资源放在同一目录中，共用代码可以放在 `src`。以下文件均相对源包根目录。

## `package.json`

```json
{
  "name": "capture-loom",
  "version": "0.1.0",
  "type": "module",
  "scripts": {"build": "intloom build"},
  "loom": {
    "type": "loom",
    "version": "2026-10-15",
    "name": "capture",
    "inputs": ["prompt"],
    "entry": "capture",
    "stages": {
      "capture": {
        "stage": "./stages/capture/stage.yaml",
        "on": {"complete": {"end": true}}
      }
    }
  }
}
```

## `tsconfig.build.json`

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "types": ["node"],
    "skipLibCheck": true
  }
}
```

## `stages/capture/stage.yaml`

```yaml
stage:
  name: capture
  state:
    schema: "./schema/state.ts"
    initialize: "./code/initialize.ts"
  entry: save
  steps:
    save:
      type: code
      code: "./code/save.ts"
      on:
        complete:
          end: true
```

## `stages/capture/schema/state.ts`

```ts
import * as z from "zod";

export default z.strictObject({ runId: z.string(), prompt: z.string() });
```

## `stages/capture/code/initialize.ts`

```ts
import type { StageStateInitializer } from "@intloom/loom-sdk";

const initialize: StageStateInitializer = ({ runId, input }) => ({
  runId,
  prompt: input.prompt ?? "",
});
export default initialize;
```

## `stages/capture/code/save.ts`

```ts
import type { ExecutableCode } from "@intloom/loom-sdk";
import stateSchema from "../schema/state.ts";

const save: ExecutableCode = async (access) => {
  access.signal.throwIfAborted();
  const state = stateSchema.parse(access.state.value);
  await access.storage.commit([{
    type: "append_record",
    id: state.runId,
    payload: {
      loomName: "capture",
      stageName: "capture",
      data: { prompt: state.prompt },
    },
  }]);
  return { outcome: "complete" };
};
export default save;
```

## 安装与构建

```sh
bun add @intloom/loom-sdk zod
bun add --dev @intloom/cli @types/node
bun run build
```

CLI 自带 Compiler。若在自定义程序中调用 `compileLoom()`，再把 `@intloom/compiler` 加为开发依赖。生成的 `dist` 是独立发布包，包含清单、三个具名导出、声明和资源。Compiler 沿入口依赖编译，无需维护用于构建的 `include` 列表。

初始化器在进入 Stage 时提供状态，Code 读取状态、提交 Record 并返回路由 outcome。此例选择 Run ID 作为 Record ID。继续阅读[构建与分发](./build.md)。
