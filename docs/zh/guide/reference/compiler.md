---
title: Compiler 参考
---

# Compiler 参考

`@intloom/compiler` 是构建时库，由包构建脚本调用，没有单独 CLI，也不属于运行时依赖。

```ts
import { compileWorkflow } from "@intloom/compiler";

await compileWorkflow({
  packageRoot: "/absolute/path/to/workflow-package",
  tsconfigFile: "tsconfig.build.json",
});
```

| 选项 | 契约 |
| --- | --- |
| packageRoot | 必需包根目录 |
| tsconfigFile | 可选包内配置，默认 tsconfig.build.json |
| logger | 可选调用方拥有的 Utils logger |

返回 `Promise<void>`，输出写入包 `dist`。

## 流程与输出

Compiler 读取元数据和 YAML、跟随资源引用、验证拓扑/导出/依赖、生成入口、运行 TypeScript、打包 Skill 附件并核验产物。检查业务模块导出时不执行业务代码。

输出包含 workflow.generated.js 及声明/source map、引用模块和附件。命名导出为 blueprint、codes、agentSpecs。相对 .ts 导入改写为 .js，生产输出排除测试。

构建使用临时输出，验证失败保留原 dist。只在清理阶段失败时，可能报告 dist 已更新；重试前阅读诊断。

## 错误

| 错误码 | 含义 |
| --- | --- |
| SOURCE_READ_FAILED | 源文件或资源不可读 |
| SOURCE_PARSE_FAILED | JSON、YAML 或 frontmatter 无效 |
| INVALID_WORKFLOW | 定义或拓扑无效 |
| INVALID_REFERENCE | 缺失或不允许的引用 |
| INVALID_BUILD_CONFIG | 构建设置无效 |
| TYPESCRIPT_FAILED | TypeScript 失败 |
| INVALID_OUTPUT | 输出依赖或导出边界失败 |
| BUILD_FAILED | 构建协调或本地输出发布失败 |

诊断在可用时提供源位置。编译不调度 Run、不调用模型、不发布 npm、不更新版本。参见[构建验证](../development/build.md)。
