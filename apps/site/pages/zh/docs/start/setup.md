# 安装 0.4.0 CLI

在 macOS 或 Linux 上准备 npm 和 Node `^22.22.0 || ^24.0.0 || ^26.0.0`。如果配置的软件源提供这个版本，执行 `npm install --global intloom@0.4.0`，再用 `intloom --version` 核对版本。使用本地构建时，按下面的步骤安装同版本候选包。

## 使用本地候选包

进入团队提供的候选目录，里面应有 `candidate.json`、`SHA256SUMS`、`framework/` 和 `package.json`。macOS 用 `shasum -a 256 -c SHA256SUMS` 校验，Linux 用 `sha256sum -c SHA256SUMS`。然后用 Bun 1.4.4 执行：

```sh
bun install --no-env-file
export PATH="$PWD/node_modules/.bin:$PATH"
intloom --version
```

预期版本是 `0.4.0`。后续步骤继续使用这个终端，安装第三方依赖需要能访问相应的软件源。维护者如需从源码制作候选包，可在仓库根目录用 Node 26.13.0 和 Bun 1.4.4 运行 `bun install --frozen-lockfile`、`bun run release:prepare`。命令会输出 `.release/` 下的候选目录。

[运行下载好的 Loom](./run) · [创建作者项目](./build)
