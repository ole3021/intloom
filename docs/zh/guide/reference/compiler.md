---
title: Compiler 参考
---

# Compiler 参考

`intloom build [path]` 构建 Loom 源包；省略路径时使用当前目录。它调用 `@intloom/compiler` 的唯一公共操作 `compileLoom()`。Compiler 使用 SDK 契约，不依赖 Kernel，也不执行业务模块。

```ts
import { compileLoom } from "@intloom/compiler";

const result = await compileLoom({
  packageRoot: "/absolute/path/to/loom-package",
  tsconfigFile: "tsconfig.build.json",
});
console.log(result.outputPath, result.diagnostics);
```

| 选项 | 契约 |
| --- | --- |
| `packageRoot` | 必需的源包目录 |
| `tsconfigFile` | 包内配置路径，默认 `tsconfig.build.json` |
| `logger` | 可选的 Utils logger |

返回 `Promise<CompileResult>`，包含 `packageRoot`、`outputPath`、`packageName`、`packageVersion`、`loomName` 和 `diagnostics`。CLI 会展示警告；调用库的程序可以读取返回值。

## 定义、检查与输出

定义放在 `package.json.loom`，协议版本为 `2026-10-15`。Stage 使用 YAML，资源通过相对路径和可选的 `#exportName` 引用。参见[定义参考](./workflow-yaml.md)。

Compiler 先校验文档再读取明确引用的资源，链接路由、生成入口、调用 TypeScript，并核验完整发布包。生成入口检查 Blueprint、Code、初始化器、JSON Schema、Tool 和 AgentSpec 的 SDK 契约。作者配置不能关闭这些契约检查。

TypeScript 只编译生成入口及其模块依赖；原配置的 `include` 和项目 `references` 不参与扩展编译范围。Skill 目录的附件单独复制。不得将测试、越界引用或未声明的 JavaScript/声明依赖带入产物。构建不捆绑 npm 依赖。

`dist` 包含 `loom.generated.js`、声明/source map、引用模块、Skill 附件及独立 `package.json`。清单由 Compiler 生成，根入口恰好导出 `blueprint`、`codes`、`agentSpecs`；`loom` 只保留协议 `type`、`version`。源包的导出映射、脚本和开发依赖不复制到发布清单。

本地再导出支持命名、别名、`export *` 和能找到实际定义的循环链；缺失或歧义导出失败，`export *` 不转发 default。第三方包的实际运行行为仍需要消费验证。

## 警告与错误

`UNREACHABLE_STAGE`、`UNREACHABLE_STEP` 表示从 Loom 入口沿声明路由无法到达。它们不阻止构建，也不会删除节点。合法循环不产生循环错误。可达性不推断 Code 或模型实际会返回哪个 outcome。

诊断包含 `severity`、`code`、`message`、可用的文件/行列/Stage/Step 位置，以及相关资源位置。文档中的独立结构错误会一起报告；依赖失败不会继续产生后续错误。错误通过 `LoomError` 抛出，结构化诊断在 `cause.diagnostics`；可用时兼有 `cause.location`。

| 错误码 | 含义 |
| --- | --- |
| SOURCE_READ_FAILED | 源文件或资源不可读 |
| SOURCE_PARSE_FAILED | JSON、YAML 或 frontmatter 无效 |
| INVALID_LOOM | 定义或拓扑无效 |
| INVALID_REFERENCE | 不允许的资源引用 |
| INVALID_BUILD_CONFIG | 构建配置无效 |
| TYPESCRIPT_FAILED | TypeScript 或 SDK 契约检查失败 |
| INVALID_OUTPUT | 导出、声明、依赖或资源检查失败 |
| BUILD_FAILED | 构建锁、输出替换或清理失败 |

## 重复构建与中断

Code/Agent ID 根据相对路径、导出和完整 Agent 绑定稳定生成。同样的源码、配置、依赖和工具链应生成相同产物；逻辑 ID 稳定不代表代码版本相同。Kernel 的恢复身份仍需考虑实际产物内容。

`.intloom-build.lock` 记录构建进程，生成源码和候选产物放在 `.intloom-build-*`。验证成功才替换 `dist`；验证失败保留旧输出。替换后清理失败会报告输出可能已更新；恢复旧输出失败时会保留备份位置。

进程异常退出后，先确认锁中进程已结束，检查临时目录中的 `previous-dist` 备份，再移除残留锁并重建。Compiler 不自动抢占锁或删除中断后的恢复证据。

构建不执行 Run、不调用模型、不发布 npm、不更新版本。继续阅读[构建与分发](../development/build.md)。
