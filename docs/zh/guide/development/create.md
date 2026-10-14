---
title: 创建第一个 Workflow
---

# 创建第一个 Workflow

创建一个只含 Code 的 `capture` Workflow，将原始意图保存为 Record。在新的 `capture-workflow` 目录中创建以下文件。示例使用当前产物协议，请选择兼容 SDK/Compiler 版本。

清单起初不包含依赖，后面的安装命令会添加真实依赖并锁定解析版本。TypeScript include 只包含生产资源目录，构建脚本属于开发文件。

## `package.json`

```json
{
  "name": "capture-workflow",
  "version": "0.1.0",
  "type": "module",
  "scripts": {"build": "node build.ts"},
  "exports": {
    ".": {
      "types": "./dist/workflow.generated.d.ts",
      "default": "./dist/workflow.generated.js"
    },
    "./package.json": "./package.json"
  },
  "files": ["dist"],
  "intloom": {"type": "workflow", "version": "2026-10-08"}
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
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "types": ["node"],
    "skipLibCheck": true
  },
  "include": ["codes/**/*.ts", "schemas/**/*.ts", "initializers/**/*.ts"],
  "exclude": ["dist", "node_modules", "**/*.spec.ts", "test"]
}
```

## `workflow.yaml`

```yaml
workflow:
  name: capture
  entry: capture
  stages:
    capture:
      stage: "@stages/capture"
      on:
        complete:
          end: true
```

## `stages/capture.yaml`

```yaml
stage:
  name: capture
  state:
    schema: "@schemas/state"
    initialize: "@initializers/state"
  entry: save
  steps:
    save:
      type: code
      code: "@codes/capture"
      on:
        complete:
          end: true
```

## `schemas/state.ts`

```ts
import * as z from "zod";

export default z.strictObject({
  runId: z.string(),
  intent: z.string(),
});
```

## `initializers/state.ts`

```ts
import type { StageStateInitializer } from "@intloom/workflow-sdk";

const initialize: StageStateInitializer = ({ runId, intent }) => ({
  runId,
  intent,
});

export default initialize;
```

## `codes/capture.ts`

```ts
import type { ExecutableCode } from "@intloom/workflow-sdk";
import stateSchema from "../schemas/state.ts";

const capture: ExecutableCode = async (_input, access) => {
  access.signal.throwIfAborted();
  const state = stateSchema.parse(access.state.value);
  await access.storage.commit([{
    type: "append_record",
    id: state.runId,
    payload: {
      flowName: "capture",
      stageName: "capture",
      data: { intent: state.intent },
    },
  }]);
  return { outcome: "complete" };
};

export default capture;
```

## `build.ts`

```ts
import { fileURLToPath } from "node:url";
import { compileWorkflow } from "@intloom/compiler";

await compileWorkflow({
  packageRoot: fileURLToPath(new URL(".", import.meta.url)),
});
```

## 安装并编译

在包目录执行：

```sh
bun add @intloom/workflow-sdk zod
bun add --dev @intloom/compiler @types/node typescript
bun run build
```

Compiler 在 `dist` 生成命名导出 `blueprint`、`codes`、`agentSpecs`。初始化器在 Stage 进入时提供 Schema 输入；Code 读取 State，提交 Record，最后只返回路由 outcome。以 Run ID 作为 Record ID 是本示例的约定。

下一步：[打包并安装 Workflow](./build.md)。即使本示例只有 Code，CMD 服务接收策略仍要求模型配置；外部 MCP 配合 `useMcpAgent: true` 可以无需项目模型执行。
