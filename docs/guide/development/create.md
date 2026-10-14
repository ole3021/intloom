---
title: Create your first Workflow
---

# Create your first Workflow

Build a small Code-only `capture` Workflow that saves the original intent as a Record. Create a new `capture-workflow` directory and place the following files inside it. This example uses the current artifact protocol; choose compatible SDK/Compiler releases.

The manifest starts without dependencies. Install commands below add the actual dependencies and lock their resolved versions. Keep production source directories in the TypeScript include list; the build script is a development file.

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

## Install and compile

Run from the package directory:

```sh
bun add @intloom/workflow-sdk zod
bun add --dev @intloom/compiler @types/node typescript
bun run build
```

Compiler produces the named exports `blueprint`, `codes` and `agentSpecs` in `dist`. The initializer supplies Schema input on Stage entry; Code reads State, commits the Record and returns only a routing outcome. Using the Run ID as Record ID is this example's convention.

Next, [package and install the Workflow](./build.md). CMD service admission requires a model configuration even for this Code-only example; external MCP with `useMcpAgent: true` can execute it without project models.
