# @intloom/utils

Shared error handling, ID generation, and file logging for Node.js applications inside and outside IntLoom. Consumers own business definitions and rules.

## Installation

Requires Node.js 22.22.0+. Repository development uses Node.js 24+ and Bun. To install a published version in a consuming project:

```sh
bun add @intloom/utils
```

IntLoom repository workspaces declare `"@intloom/utils": "workspace:*"` instead. The package includes TypeScript declarations and provides an ESM root entry; module subpath imports are not available.

## Usage

```ts
import { defineErrorCatalog, generateId } from "@intloom/utils";

const errors = defineErrorCatalog({
  NOT_FOUND: { message: "The requested resource was not found." },
  BUSY: { message: "The requested resource is busy.", retryable: true },
});

const requestId = generateId("REQUEST");
const error = errors.create("NOT_FOUND", {
  message: `Request ${requestId} was not found.`,
});

console.log(error.code, error.message, error.retryable);
```

## Modules

| Module | Public API | Details |
| --- | --- | --- |
| Error | `LoomError`, `isLoomError`, `defineErrorCatalog` | [Construction, wrapping, and recognition](https://github.com/ole3021/intloom/blob/main/packages/utils/src/error/README.md) |
| ID | `generateId`, `generateRunId` | [Prefixed random IDs and timestamped Run IDs](https://github.com/ole3021/intloom/blob/main/packages/utils/src/id/README.md) |
| Logger | `openLog`, `getLogger`, `withLogger`, `silentLogger`, `readLog`, `followLog`, `logLevels` | [JSONL files, asynchronous context, and reading](https://github.com/ole3021/intloom/blob/main/packages/utils/src/logger/README.md) |

All functions and public types are exported from `@intloom/utils`; see the [public entry](https://github.com/ole3021/intloom/blob/main/packages/utils/src/index.ts) for the complete list.
