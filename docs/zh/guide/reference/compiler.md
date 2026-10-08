---
title: Compiler 参考
description: compileWorkflow 选项、生成产物、验证边界和构建错误。
---

# Compiler 参考

`@intloom/compiler` 是构建时库，没有独立 CLI，已安装的 Workflow 在运行时不需要它。

## compileWorkflow

```ts
import { compileWorkflow } from "@intloom/compiler";

await compileWorkflow({
  packageRoot: "/absolute/path/to/workflow-package",
  tsconfigFile: "tsconfig.build.json",
});
```

| 选项 | 要求 |
| --- | --- |
| `packageRoot` | 必填，包目录 |
| `tsconfigFile` | 可选，包内部的配置路径，默认 `tsconfig.build.json` |
| `logger` | 可选，由调用者管理的 Utils logger |

返回类型为 `Promise<void>`。输出写入包的 `dist`；函数不会返回运行中的 Runtime 或 Agent 注册表。未显式提供 logger 时，使用当前日志上下文，或保持静默。

## 输入与输出

编译读取包元数据和 `workflow.yaml`，跟踪 Stage、Code、Agent、Schema、Tool、Skill 和初始化器引用，验证定义和导出，分配资源 ID，生成入口，调用 TypeScript，打包引用的资源，并验证输出产物。

预期输出包括：

```text
dist/
├── workflow.generated.js
├── workflow.generated.d.ts
├── workflow.generated.js.map
└── compiled referenced modules and Skill assets
```

源码中的相对 `.ts` 导入变为输出中的 `.js` 导入。生产模块同时生成类型声明和 source maps，测试及测试目录会排除。源包必须声明生成的 JS 和类型声明入口，并在 `files` 中包含 `dist`。

## 构建保证与限制

业务模块通过静态检查发现导出，不会执行模块。初始化器输出为可调用资源，编译不会运行它们。引用的运行时包必须声明为 dependencies 或 peers。Schema/Tool 形状检查和源码导出检查不能替代已安装服务的实际执行。

构建使用临时输出，验证后替换 `dist`。验证失败会保留之前的输出。生成入口用于协调同一包的并发构建；构建活跃时不要删除它。进程中断后应检查过期构建资源。

编译不会发布 npm 包、请求模型、调度 Run、生成发布根目录 manifest 或自动更新版本。

## 错误

| 错误码 | 含义 |
| --- | --- |
| `SOURCE_READ_FAILED` | 无法读取源码根目录或资源 |
| `SOURCE_PARSE_FAILED` | JSON、YAML 或 frontmatter 无效，包括重复键 |
| `INVALID_WORKFLOW` | 定义或拓扑无效 |
| `INVALID_REFERENCE` | 资源引用无效、缺失或不被允许 |
| `INVALID_BUILD_CONFIG` | 构建配置或输出位置无效 |
| `TYPESCRIPT_FAILED` | TypeScript 编译失败 |
| `INVALID_OUTPUT` | 输出模块、依赖或导出边界验证失败 |
| `BUILD_FAILED` | 构建协调或本地输出发布失败 |

诊断在可用时包含源码位置。检查报告的失败、修正源码并重新构建；旧 `dist` 被保留不意味着本次构建成功。

构建与清理同时失败时，仍保留原始 Compiler 错误码、消息和位置。`error.cause.cause` 是 `AggregateError`，首先包含原始错误，随后包含清理错误。清理会分别尝试删除临时目录和生成入口；输出恢复失败时保留恢复备份。

仅清理失败时报告 `BUILD_FAILED`，并明确说明 `dist` 已经更新。重试前应检查残留构建资源；这不是保留旧输出的验证失败。
