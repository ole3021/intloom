---
title: Create a Workflow
description: Build a minimal Code-only package with a Stage schema, initializer, and durable result.
---

# Create a Workflow

A Workflow package contains source definitions and a compiled ESM entry. This guide builds a small `capture` workflow: it saves the original intent as one Record, then completes. It needs no Agent to demonstrate the package and execution contracts.

This is an authoring walkthrough within the framework docs. Business-specific workflow manuals and full application examples are separate concerns.

## Prepare the package

Create this layout in a new package directory:

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

Use this `package.json`:

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
    "@intloom/workflow-sdk": "0.0.1",
    "zod": "^4.6.5"
  },
  "devDependencies": {
    "@intloom/compiler": "0.0.1",
    "@types/node": "^24",
    "typescript": "7.0.2"
  },
  "intloom": {
    "type": "workflow",
    "version": "2026-10-08"
  }
}
```

The IntLoom versions above match this development tree. They require those releases to be available from your registry. Before publication, supply verified local packages or a local registry. Within the IntLoom monorepo, use `workspace:*` for workspace dependencies and the root Bun/Turbo commands.

For this standalone package, use `tsconfig.build.json`:

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

The Compiler overrides emission settings in a temporary build configuration. Keep `include` limited to production resource directories; including `build.ts` would emit the build script and incorrectly make the Compiler a runtime dependency. Add `tools/**/*.ts` when introducing Tools. Repository workspaces instead extend the shared root TypeScript configuration.

## Define the route

`workflow.yaml`:

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

`stages/capture.yaml`:

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

Ending the Step ends its Stage. The Stage's outcome is then routed by `workflow.yaml` to the Workflow end.

## Initialize business State

`schemas/state.ts`:

```ts
import * as z from "zod";

export default z.strictObject({
  runId: z.string(),
  intent: z.string(),
});
```

`initializers/state.ts`:

```ts
import type { StageStateInitializer } from "@intloom/workflow-sdk";

const initialize: StageStateInitializer = ({ runId, intent }) => ({
  runId,
  intent,
});

export default initialize;
```

The initializer runs when the Stage is entered. It receives the current Run's context and returns Schema input. Compilation does not execute it.

## Implement the Step

`codes/capture.ts`:

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

The Run ID is this package's chosen Record ID, not a framework requirement. The Step reads Stage State; the Runtime currently passes `null` as execution input. Return only the routing outcome.

## Compile

`build.ts`:

```ts
import { fileURLToPath } from "node:url";
import { compileWorkflow } from "@intloom/compiler";

await compileWorkflow({
  packageRoot: fileURLToPath(new URL(".", import.meta.url)),
});
```

After resolving the package dependencies:

```sh
bun install
bun run build
```

Expected output includes `dist/workflow.generated.js`, declarations, compiled business modules, and source maps. The generated module exports `blueprint`, `codes`, and `agentSpecs`; this Code-only package has no Agent resources.

Continue with [Build, test, and distribute](./build.md) to package and install it. For a model-free execution of this Code-only workflow, use the external MCP entry with `useMcpAgent: true`. The current CLI admission policy still requires `llms.default` for service execution.
