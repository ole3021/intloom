---
title: Compiler reference
---

# Compiler reference

`intloom build [path]` builds a Loom source package; the default path is the current directory. It calls the single public operation of `@intloom/compiler`, `compileLoom()`. Compiler uses SDK contracts without depending on Kernel or executing business modules.

```ts
import { compileLoom } from "@intloom/compiler";

const result = await compileLoom({
  packageRoot: "/absolute/path/to/loom-package",
  tsconfigFile: "tsconfig.build.json",
});
console.log(result.outputPath, result.diagnostics);
```

| Option | Contract |
| --- | --- |
| `packageRoot` | Required source package directory |
| `tsconfigFile` | In-package config, default `tsconfig.build.json` |
| `logger` | Optional Utils logger |

Returns `Promise<CompileResult>` containing `packageRoot`, `outputPath`, `packageName`, `packageVersion`, `loomName` and `diagnostics`. CLI displays warnings; library callers can inspect the result.

## Definitions, checks and output

Definitions live in `package.json.loom`, using protocol `2026-10-14`. Stages use YAML and relative resource paths with optional `#exportName`. See the [definition reference](./workflow-yaml.md).

Compiler validates documents before following explicit references, links routes, generates the entry, invokes TypeScript and verifies the distribution. The generated entry checks Blueprint, Code, initializers, JSON-valued Schemas, Tools and AgentSpec against SDK. Author settings cannot disable these contract checks.

TypeScript compiles only the generated entry and its module dependencies; inherited `include` and project `references` cannot expand the compilation scope. Skill directory assets are copied separately. Tests, escaping references and undeclared JavaScript/declaration dependencies are rejected. npm dependencies are not bundled.

`dist` contains `loom.generated.js`, declarations/source maps, referenced modules, Skill assets and an independent `package.json`. Compiler generates the manifest and its root entry exports exactly `blueprint`, `codes`, `agentSpecs`; `loom` retains only protocol `type` and `version`. Source export maps, scripts and development dependencies are not copied into the distribution manifest.

Local re-exports support named exports, aliases, `export *` and cyclic chains with an actual defining binding. Missing or ambiguous bindings fail; `export *` does not forward default. Third-party package runtime behavior still requires consumer verification.

## Warnings and errors

`UNREACHABLE_STAGE` and `UNREACHABLE_STEP` identify nodes unreachable from the Loom entry along declared routes. They neither block the build nor remove nodes. Legal cycles are accepted. Reachability does not predict outcomes returned by Code or models.

Diagnostics contain `severity`, `code`, `message`, available file/line/column/Stage/Step locations and related resource locations. Independent document structure errors are reported together; dependent work stops after failure. Errors are thrown as `LoomError`, with structured diagnostics in `cause.diagnostics` and an available first location in `cause.location`.

| Code | Meaning |
| --- | --- |
| SOURCE_READ_FAILED | Unreadable source/resource |
| SOURCE_PARSE_FAILED | Invalid JSON, YAML or frontmatter |
| INVALID_LOOM | Invalid definition/topology |
| INVALID_REFERENCE | Disallowed resource reference |
| INVALID_BUILD_CONFIG | Invalid build configuration |
| TYPESCRIPT_FAILED | TypeScript or SDK contract failure |
| INVALID_OUTPUT | Export, declaration, dependency or asset failure |
| BUILD_FAILED | Lock, output replacement or cleanup failure |

## Repeatable builds and interruptions

Code/Agent IDs are stable for relative resource paths, exports and complete Agent bindings. Identical source, configuration, dependencies and toolchain should produce identical artifacts. Logical ID stability does not establish code-version identity; Kernel recovery still considers actual artifact content.

`.intloom-build.lock` records the owner process; generated source and candidate output live in `.intloom-build-*`. Only verified output replaces `dist`. Validation failures preserve old output. Cleanup failures after replacement report that output may already be updated; failed restoration retains the backup location.

After a process crash, verify the recorded owner has exited, inspect temporary `previous-dist` backups, then remove the stale lock and rebuild. Compiler never automatically steals locks or deletes interrupted recovery evidence.

Building does not execute a Run, call a model, publish to npm or bump versions. Continue with [building and distribution](../development/build.md).
