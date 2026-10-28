# IntLoom

[English](README.md)

IntLoom 是执行 Loom 的框架。仓库包含执行内核、SDK、编译工具与配套应用；业务 Loom 独立维护。

## 仓库结构

- `apps/`：命令行与网站应用。
- `packages/`：SDK、Compiler、Kernel 与通用工具。
- `docs/`：用户与开发者文档。

## 开发

使用 `package.json` 指定的 Bun 版本。

```sh
bun install --frozen-lockfile
bun run check
bun run build
```

`check` 执行 Biome 检查和 workspace 类型检查。`build` 执行 workspace 构建脚本。`verify` 依次执行两者。`format` 格式化支持的源码与配置文件。
