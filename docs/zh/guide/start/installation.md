---
title: 安装 IntLoom
---

# 安装 IntLoom

## 环境要求

使用 **Node.js 26.4.0 或更高版本**。TUI 需要交互终端。仓库和 Workflow 开发使用 Bun；使用已安装的 CLI 不要求安装 Bun。

```sh
node --version
npm install -g intloom
intloom --version
intloom --help
```

`intloom` 和 `@intloom/cli` 都提供同一个命令，选择一个安装即可。私有 Kernel 随 CLI 提供，业务 Workflow 包需要单独安装。

## 核对实际命令

如果版本不符合预期，在 macOS/Linux 使用 `command -v intloom`，在 Windows 使用 `where intloom` 检查可执行文件的解析结果。重定向终端中先使用 `--help`，避免直接打开 TUI。

## 从源码开发

在仓库根目录安装依赖并构建开发启动器：

```sh
bun install --frozen-lockfile
bun run build:dev
```

Bun 全局 bin 目录在 PATH 中时，`intloom-dev` 使用当前 checkout 的构建产物。源码或 Node 改变后需要重新构建。修改 Kernel 或 Service 时，先停止测试项目已有的 Service，构建后再启动。重新打开 TUI 才会加载新界面代码。

下一步：[初始化项目](./project.md)。
