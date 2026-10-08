---
title: 安装与项目配置
description: 准备 CLI，初始化空项目，并安装兼容的 Workflow 包。
---

# 安装与项目配置

使用 Node.js 24 或更新版本。完整的本地验收使用 Node.js 24。安装 Workflow 要求 `PATH` 中可找到 npm；开发本仓库还需要 Bun 1.4.0 或更新版本。

## 使用当前源码

在经过验证的公开版本可用之前，从仓库根目录构建 CLI：

```sh
bun install
bun run build --filter=@intloom/cli --concurrency=1
node apps/cli/dist/bin.js --version
node apps/cli/dist/bin.js --help
```

使用源码构建时，将本文档命令中的 `intloom` 替换为 `node /absolute/path/to/intloom/apps/cli/dist/bin.js`。切换到项目目录后，仍需使用绝对路径。

## 安装已发布版本

只有当所选版本及其依赖在使用的包注册源中可用时，才使用以下方式：

```sh
npm install -g intloom
intloom --version
```

`npm install -g @intloom/cli` 提供同一个命令，选择其中一个入口即可。无作用域包依赖版本匹配的作用域 CLI 包。发布到注册源和在本仓库构建是两件事；找不到包不代表项目配置有问题。

## 初始化项目

```sh
intloom init my-project
cd my-project
```

目标目录必须是新建或空目录，包括隐藏文件在内。初始化不会覆盖已有仓库、合并配置或启动服务。它会创建：

```text
my-project/
├── intloom.yaml
├── .gitignore
├── intloom/
│   ├── project/
│   ├── artifacts/
│   └── records/
└── .intloom/
    └── workflows/
```

业务根目录不需要 `package.json`。如果想在已有源码上试用 IntLoom，请创建独立的初始化工作副本，再放入相关业务文件。当前不支持直接初始化非空目录。

## 安装 Workflow

从作者处获取编译后的包，将下面的路径替换为实际归档文件：

```sh
intloom workflow add /absolute/path/to/workflow.tgz
intloom workflow list
```

归档文件仍需要可解析的运行时依赖。除非作者明确打包，否则它不会包含 SDK 或其他依赖。公开版本发布前，请使用本地注册源或其他经过验证的依赖配置；不能假设复制一个归档文件就足够。

也支持已发布的包名和精确版本。初始化时可通过 `intloom init my-project --workflow /absolute/path/to/workflow.tgz` 同时安装。

预期结果是 `workflow list` 显示包声明和安装完整性。服务启动后，通过 `flows` 检查执行名称；执行名称可能不同于 npm 包名。

接下来阅读 [MCP](./mcp.md) 或 [CLI](./cli.md)。升级和恢复安装的方法见[包管理](../usage/packages.md)。

