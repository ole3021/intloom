---
title: 创建 Workflow
description: 构建最小的纯 Code 包，包含 Stage Schema、初始化器和持久化结果。
---

# 创建 Workflow

Workflow 包包含源定义和编译后的 ESM 入口。本指南构建一个小型 `capture` 工作流：将原始意图保存为一个 Record，然后结束。该示例无需 Agent 即可展示包与执行契约。

这是框架文档中的编写指南；特定业务 Workflow 的手册和完整应用示例属于其他内容。

## 准备包

在新的包目录中创建以下布局：

```text
capture-workflow/
├── package.json
├── tsconfig.build.json
├── build.ts
├── workflow.yaml
├── stages/capture.yaml
├── schemas/state.ts
├── initializers/state.ts
└── codes/capture.ts
```

使用以下 `package.json`：

```json
{
  "name": "capture-workflow",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/workflow.generated.d.ts",
      "default": "./dist/workflow.generated.js"
    },
    "./package.json": "./package.json"
  },
  "files": ["dist"],
  "scripts": {
    "build": "node build.ts"
  },
  "dependencies": {
    "@intloom/workflow-sdk": "0.0.2",
    "zod": "^4.6.5"
  },
  "devDependencies": {
    "@intloom/compiler": "0.0.2",
    "@types/node": "^22",
    "typescript": "7.0.2"
  },
  "intloom": {
    "type": "workflow",
    "version": "2026-10-08"
  }
}
```

以上 IntLoom 版本与当前开发版本一致，要求对应版本已经在使用的注册源中可用。发布前请提供经过验证的本地包或本地注册源。IntLoom monorepo 中，工作区依赖使用 `workspace:*`，并使用根目录的 Bun/Turbo 命令。

这个独立包使用以下 `tsconfig.build.json`：

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
  "exclude": ["dist", "node_modules", "**/*.spec.ts", "**/*.intg.ts", "test"]
}
```

Compiler 在临时构建配置中覆盖输出设置。将 `include` 限定为生产资源目录；包含 `build.ts` 会输出构建脚本，并错误地将 Compiler 变为运行时依赖。引入 Tools 时添加 `tools/**/*.ts`。仓库工作区则继承共享的根 TypeScript 配置。

## 定义路由

`workflow.yaml`：

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

`stages/capture.yaml`：

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

Step 结束时，其 Stage 也结束。Stage 的 outcome 再由 `workflow.yaml` 路由到 Workflow 结束位置。

## 初始化业务 State

`schemas/state.ts`：

```ts
import * as z from "zod";

export default z.strictObject({
  runId: z.string(),
  intent: z.string(),
});
```

`initializers/state.ts`：

```ts
import type { StageStateInitializer } from "@intloom/workflow-sdk";

const initialize: StageStateInitializer = ({ runId, intent }) => ({
  runId,
  intent,
});

export default initialize;
```

进入 Stage 时运行初始化器。它接收当前 Run 的上下文，并返回 Schema 的输入。编译过程不会执行它。

## 实现 Step

`codes/capture.ts`：

```ts
import type { ExecutableCode } from "@intloom/workflow-sdk";
import stateSchema from "../schemas/state.ts";

const capture: ExecutableCode = async (_input, access) => {
  access.signal.throwIfAborted();
  const state = stateSchema.parse(access.state.value);
  await access.storage.commit([
    {
      type: "append_record",
      id: state.runId,
      payload: {
        flowName: "capture",
        stageName: "capture",
        data: { intent: state.intent },
      },
    },
  ]);
  return { outcome: "complete" };
};

export default capture;
```

这个包选择 Run ID 作为 Record ID，这是包的约定，不是框架要求。Step 读取 Stage State；Runtime 当前传入 `null` 作为执行输入。只返回路由 outcome。

## 编译

`build.ts`：

```ts
import { fileURLToPath } from "node:url";
import { compileWorkflow } from "@intloom/compiler";

await compileWorkflow({
  packageRoot: fileURLToPath(new URL(".", import.meta.url)),
});
```

解析并安装包依赖后：

```sh
bun install
bun run build
```

预期输出包括 `dist/workflow.generated.js`、类型声明、编译后的业务模块和 source maps。生成模块导出 `blueprint`、`codes` 和 `agentSpecs`；该纯 Code 包没有 Agent 资源。

接着阅读[构建、测试与分发](./build.md)，完成打包与安装。如果希望无需模型执行这个纯 Code 工作流，使用 `useMcpAgent: true` 的外部 MCP 入口。当前 CLI 的服务执行准入策略仍要求 `llms.default`。
