# intloom

intloom 的实现工作区，使用 Bun Workspaces + Turborepo + TypeScript，使用 Biome 统一 lint 和 format。项目仍处于初始化阶段，产品能力将随 Intent Loom 设计确认逐步落地。

Bun 用于依赖管理、开发运行和测试。TypeScript 通过 `NodeNext` 输出 Node.js ESM、类型声明和 source map，不打包 Bun 运行时，不安装 Bun 类型或运行时依赖。运行环境为 Node.js 24+，开发使用 Bun 1.4.0。

## 开始

```sh
bun install
bun run dev
```

`apps/site` 是 Rspress 官网与用户文档网站，读取根目录 `docs/`。`packages/core` 是共享包。开发时启动各工作区的开发监听；按 Ctrl+C 停止。

只开发网站时运行 `bun run dev --filter=@intloom/site`。应用介绍见 [site README](./apps/site/README.md)，本地开发、配置和发布流程见 [网站开发维护指南](./apps/site/DEVELOPMENT.md)。

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
| `bun run test` | 先编译，再执行各工作区测试 |

需要单独运行某个工作区时，在 Turbo 命令后加 `--filter=@intloom/site` 等包名筛选，例如 `bun run build --filter=@intloom/site`。不为每个应用增加根目录命令别名。

Biome 直接在根目录运行，覆盖根配置和所有工作区。关闭额外的 assist 检查，使 `check` 保持 lint + format + typecheck。格式化范围为 Biome 支持的文件类型，Markdown 不在此范围内。

## 添加工作区

- 应用放入 `apps/*`，共享包放入 `packages/*`，每个目录包含独立的 `package.json`。
- TypeScript 配置继承根目录的 `tsconfig.base.json`，Node.js 包配置自己的 `rootDir`、`outDir` 和 `include`；网站工作区覆盖 DOM、JSX 和 Bundler 模块选项，由 Rspress 输出静态产物。
- 按需提供 `dev`、`build`、`typecheck`、`test` 脚本，Turbo 自动发现；lint 和 format 继续使用根配置。
- 包之间使用 `workspace:*` 依赖，共享包导出 `dist` 中的 JavaScript 和类型声明。
- 源码使用标准 JavaScript 和 `node:*` API；Biome 禁止直接使用 `Bun` 全局对象以及导入 `bun`、`bun:*` 模块，TypeScript 仅加载 Node.js 类型。相对 ESM 导入使用 `.js` 后缀。
- 新增依赖后运行 `bun install` 并提交 `bun.lock`。CI 使用 `bun install --frozen-lockfile`，随后执行 `bun run check` 和 `bun run test`；测试通过 Turbo 依赖自动触发构建。网站还执行 `ci:check` 校验部署配置。

Turbo 缓存构建产物及成功的检查、测试结果；共享 TypeScript 配置变化会使缓存失效。测试文件放在 `test/`，不进入发布产物。

## 网站发布

网站使用 Workers Static Assets，由 GitHub Actions 发布：`master` 更新生产，`feat-*` 上传带固定分支别名的预览版本。Pull Request 和当前的 `main` 分支只运行 CI。首次发布需要在 GitHub Secrets 设置 `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`，并先从 `master` 初始化 Worker。

具体设置、预览地址和部署验证见 [网站开发维护指南](./apps/site/DEVELOPMENT.md)。

## 密钥约定

部署凭据保存在 GitHub Secrets，只传给部署步骤。当前静态网站无需业务密钥。

未来服务应用自身的密钥由 dotenvx 加密文件保存。根工具链已安装 `@dotenvx/dotenvx`，需要时直接通过 `bun run dotenvx <命令>` 调用已安装的工具，不额外定义同名 script。

- 每个实际需要密钥的服务使用自己的 `.env.encrypted`，可提交的内容应为 dotenvx 公钥和 `encrypted:` 密文。
- `.env.keys` 及其副本、明文 `.env*`、`.dev.vars*` 均忽略；仅 `.env.example` 与 `.env.encrypted` 允许入库。文件名本身不会自动加密，提交前必须确认实际已加密。
- 本地私钥留在服务的 `.env.keys`，并在仓库外安全备份；部署环境通过受限的运行时密钥配置注入解密私钥。不要把私钥和密文一同打包。
- Node.js 服务可以通过 `dotenvx run` 启动。若未来增加 Workers 服务，其运行时没有 Node.js CLI 启动流程，需要在该服务接入时明确解密与绑定方式。
- 网站目前不加载 dotenvx 文件，也不创建空密钥或假凭据。解密后的服务密钥不得注入浏览器构建。

未来服务的示例操作（将 `apps/service` 替换为实际服务目录）：

```sh
# 在编辑器中填写 .env.encrypted，随后立即加密；加密完成前不要提交。
# 使用纯文件模式，不接入 OS 密钥存储或 dotenvx Armor。
bun run dotenvx encrypt --no-native --no-armor -f apps/service/.env.encrypted -fk apps/service/.env.keys
# 显式指定私钥文件；解密或配置错误时停止启动。
bun run dotenvx run --strict --no-native --no-armor -f apps/service/.env.encrypted -fk apps/service/.env.keys -- node apps/service/dist/index.js
```

参考：[dotenvx 加密](https://dotenvx.com/docs/quickstart/encryption/)。
