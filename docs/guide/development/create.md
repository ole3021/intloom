---
title: Create your first Loom
---

# Create your first Loom

Create a Code-only `capture` Loom that saves this Run’s `prompt` as a Record. Keep Stage resources together; shared code can live in `src`. Paths below are relative to the source package.

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

## Install and build

```sh
bun add @intloom/loom-sdk zod
bun add --dev @intloom/cli @types/node
bun run build
```

CLI includes Compiler. Add `@intloom/compiler` as a development dependency when calling `compileLoom()` from your own program. Generated `dist` is an independent distribution containing a manifest, three named exports, declarations and resources. Compiler follows entry dependencies, so no build-specific `include` list is needed.

The initializer provides state on Stage entry. Code reads state, commits a Record and returns an outcome. Using the Run ID as Record ID is this example’s convention. Continue with [building and distribution](./build.md).
