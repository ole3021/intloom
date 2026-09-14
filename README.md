# intloom

最小 Bun Workspaces + Turborepo + TypeScript 项目框架，使用 Biome 统一 lint 和 format。

Bun 用于依赖管理、开发运行和测试。TypeScript 通过 `NodeNext` 输出 Node.js ESM、类型声明和 source map，不打包 Bun 运行时，不安装 Bun 类型或运行时依赖。运行环境为 Node.js 24+，开发使用 Bun 1.4.0。

## 开始

```sh
bun install
bun run dev
```

`apps/example` 是最小应用，依赖 `packages/core` 共享包。开发时先构建依赖，再同时监听共享包编译和 Bun 应用重启；按 Ctrl+C 停止。

## 固定命令

所有命令都在仓库根目录执行，统一使用 `bun run <命令>`，避免与 Bun 内置的 `build`、`test` 命令混淆。

| 命令 | 行为 |
| --- | --- |
| `bun run dev` | 启动各工作区的开发监听，不缓存 |
| `bun run build` | 按依赖顺序编译，产物保存到各包的 `dist/` |
| `bun run typecheck` | 检查各包类型；需要时先构建依赖包的类型声明 |
| `bun run lint` | 使用 Biome 检查整个仓库，不修改文件 |
| `bun run format` | 使用 Biome 自动修正支持文件的格式 |
| `bun run check` | 检查 lint、格式和类型，不自动修正文件 |
| `bun run test` | 先编译，再由 Bun 执行测试；应用测试会实际启动 Node.js 验证产物 |

Biome 直接在根目录运行，覆盖根配置和所有工作区。关闭额外的 assist 检查，使 `check` 保持 lint + format + typecheck。格式化范围为 Biome 支持的文件类型，Markdown 不在此范围内。

## Node.js 运行

```sh
bun run build
node apps/example/dist/index.js
```

预期输出 `Hello, intloom!`。产物是标准 ESM，不是单文件 bundle；运行时需要保留工作区依赖链接以及共享包的 `package.json` 和 `dist/`。

## 添加工作区

- 应用放入 `apps/*`，共享包放入 `packages/*`，每个目录包含独立的 `package.json`。
- TypeScript 配置继承根目录的 `tsconfig.base.json`，配置自己的 `rootDir`、`outDir` 和 `include`。
- 按需提供 `dev`、`build`、`typecheck`、`test` 脚本，Turbo 自动发现；lint 和 format 继续使用根配置。
- 包之间使用 `workspace:*` 依赖，共享包导出 `dist` 中的 JavaScript 和类型声明。
- 源码使用标准 JavaScript 和 `node:*` API；Biome 禁止直接使用 `Bun` 全局对象以及导入 `bun`、`bun:*` 模块，TypeScript 仅加载 Node.js 类型。相对 ESM 导入使用 `.js` 后缀。
- 新增依赖后运行 `bun install` 并提交 `bun.lock`。CI 使用 `bun install --frozen-lockfile`，随后执行 `bun run check`、`bun run build` 和 `bun run test`。

Turbo 缓存构建产物及成功的检查、测试结果；共享 TypeScript 配置变化会使缓存失效。测试文件放在 `test/`，不进入发布产物。
