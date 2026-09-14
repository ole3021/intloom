# 网站开发维护

本指南面向 `@intloom/site` 的开发与维护人员，按环境准备、本地开发、验证、配置和发布的顺序组织。应用介绍见 [README](./README.md)，工作区通用约定见 [根 README](../../README.md)。

以下命令均在仓库根目录执行。

## 环境准备与本地开发

使用 Node.js 24+ 和项目指定的 Bun 版本，版本要求见根目录 [package.json](../../package.json)。安装锁定依赖后启动网站：

```sh
bun install --frozen-lockfile
bun run dev --filter=@intloom/site
```

打开终端输出的本地地址，修改站点后查看热更新结果。按 Ctrl+C 停止服务。

## 构建与验证

| 命令 | 用途 |
| --- | --- |
| `bun run build --filter=@intloom/site` | 生成静态网站，产物输出到 `apps/site/dist/` |
| `bun run typecheck --filter=@intloom/site` | 检查网站 TypeScript 配置与组件类型 |
| `bun run test --filter=@intloom/site` | 通过 Turbo 先构建网站，再执行发布分支规则测试 |
| `bun run check` | 执行全仓库 lint、格式和类型检查 |

`test` 当前不覆盖页面样式或浏览器交互。影响页面展示的改动需要在本地查看实际效果。生成的 `dist/` 不直接编辑；全仓库 `lint`、`format` 等命令沿用根配置。

### Cloudflare 本地验证

先构建网站，再执行部署 dry run 和 Cloudflare 本地服务：

```sh
bun run build --filter=@intloom/site
bun run --cwd apps/site ci:check
bun run --cwd apps/site wrangler dev --local
```

在另一个终端检查页面状态码。下面使用默认本地地址；若终端显示其他端口，相应修改 `SITE_URL`：

```sh
SITE_URL=http://localhost:8787 node apps/site/scripts/verify-deployment.mjs
```

## 站点配置与凭据

| 配置位置 | 管理内容 |
| --- | --- |
| [rspress.config.ts](./rspress.config.ts) | 网站标题、描述、主题、内容来源和构建输出配置 |
| [tsconfig.json](./tsconfig.json) | 网站 TypeScript 类型检查配置 |
| [wrangler.jsonc](./wrangler.jsonc) | Worker 名称、兼容日期、静态资源目录、404 处理和域名配置 |
| [CI workflow](../../.github/workflows/ci.yml) | 检查、构建产物传递、分支发布与验证 |
| GitHub Secrets | `CLOUDFLARE_ACCOUNT_ID`：目标账户；`CLOUDFLARE_API_TOKEN`：发布授权 |
| [package.json](./package.json) 与 [bun.lock](../../bun.lock) | 发布工具版本与依赖锁定 |

内容来源以 `rspress.config.ts` 为准。

当前 Worker 名为 `intloom-site`，发布目录为 `apps/site/dist/`。配置启用 `workers.dev` 生产地址和版本预览地址，不存在的路径使用生成的 404 页面。

Wrangler 配置描述要发布的服务；CI 部署步骤通过上述两个 GitHub Secrets 选择 Cloudflare 账户并获得发布权限。凭据只注入部署步骤，不写入 Wrangler 配置或浏览器构建变量。

网站不使用业务密钥。未来服务的 dotenvx 文件约定见 [根 README](../../README.md#密钥约定)。

### 域名配置

当前生产与版本预览地址均使用 `workers.dev`。需要生产自定义域名时，在 `wrangler.jsonc` 的 `routes` 中添加 `custom_domain` 配置，并为发布 Token 提供对应域名配置所需权限。部署配置统一在该文件维护。

## 脚本与测试职责

| 文件 | 职责 |
| --- | --- |
| [scripts/deployment-target.mjs](./scripts/deployment-target.mjs) | 选择生产或预览命令，生成预览别名，并在 CI 执行时核验最新提交 |
| [scripts/verify-deployment.mjs](./scripts/verify-deployment.mjs) | 验证网站地址，将成功结果写入任务摘要；也可对本地服务运行 |
| [test/deployment-target.test.mjs](./test/deployment-target.test.mjs) | 直接测试分支限制，以及别名的字符、长度、稳定性和典型冲突场景；不连接 GitHub 或 Cloudflare |

### 发布命令

GitHub Actions 直接调用工作区内的三个入口：

| 入口 | 实际命令 | 用途 |
| --- | --- | --- |
| `ci:check` | `wrangler deploy --dry-run` | 校验部署配置和构建产物，不上传 |
| `ci:deploy` | `wrangler deploy` | 上传并发布生产版本 |
| `ci:preview` | `wrangler versions upload` | 上传预览版本，CI 额外传入分支别名 |

这些命令使用现有 `dist/`，不负责构建。分支限制与最新提交检查由 CI 调用的脚本执行；单独运行发布命令不会执行这些检查。日常发布使用后文的 GitHub Actions 流程。

## 首次部署

1. 在 Cloudflare 准备账户和 Workers 的 `workers.dev` 子域名。
2. 为目标账户创建具有 Workers 发布权限的 API Token。
3. 在 GitHub 仓库 **Settings → Secrets and variables → Actions** 添加 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。
4. 工作流使用 `production` 和 `preview` GitHub Environments。可以提前创建，并将生产环境的部署分支限制为 `master`。当前流程不要求人工审批；也可以将凭据改存相应 Environment Secrets，名称不变。
5. 将包含工作流和网站的变更推送到 `master`，完成首次生产部署，然后再推送 `feat-*` 分支进行版本预览。

配置文件本身不会创建账户或设置 Secrets。网站发布由 GitHub Actions 负责，避免同时启用 Cloudflare Git 自动构建而重复发布。

## 日常发布

| 分支或事件 | 行为 |
| --- | --- |
| 推送 `master` | 检查成功后执行 `ci:deploy`，更新生产版本 |
| 推送 `feat-*` | 检查成功后执行 `ci:preview`，上传带分支别名的预览版本，不切换生产流量 |
| Pull Request | 只检查，不上传部署产物，不提供 Cloudflare 发布密钥 |
| 推送 `main` | 只检查，不上传部署产物 |
| 手动触发 CI | 运行检查；仅选中的 `master` 或 `feat-*` 分支上传产物并发布，其余分支跳过部署 |

`feat-*` 指 `feat-search` 这类分支名，不包含 `/`。工作流可手动触发时，在 GitHub Actions 中选择 **CI → Run workflow**，再选择需要检查或发布的分支。

发布成功后，任务摘要包含已验证的网站 URL 和提交 SHA，GitHub Environment 也关联本次部署地址。预览部署展示的是本次上传的独立版本地址；分支别名地址可在 Wrangler 发布日志中查看。

### 生产与预览

一个功能分支持续更新同一个预览别名，每次上传同时保留独立版本地址。别名由规范化分支名（最多 20 字符）与原始名称的 SHA-256 摘要（10 字符）组成，降低大小写、特殊字符和截断造成的名称冲突。

当前别名规则要求 Worker 名称保持在 31 字符以内，使合成后的域名标签不超过 63 字符。删除分支不会自动撤销旧预览 URL。

预览构建使用 `SITE_CHANNEL=preview`，为内容页加入 `noindex, nofollow`。该变量已纳入 Turbo 缓存键；搜索索引控制不提供访问认证。生产与预览共用 Worker 和发布凭据，没有独立的生产、预览权限边界。

### CI 执行流程

[ci.yml](../../.github/workflows/ci.yml) 包含两个 job：

1. **check**：安装锁定依赖，执行 `bun run check`、`bun run test` 和网站 `ci:check`。测试通过 Turbo 依赖自动构建，不单独增加构建步骤。需要部署时上传 `site-dist` 产物，保留 7 天。
2. **deploy**：在检查成功后启动独立执行环境，安装依赖并下载产物，核验分支最新提交，再发布和验证网站。此 job 不重新构建网站。

检查 job 可以并行执行，同一分支的部署 job 不并行执行。上传前会查询 GitHub 分支当前 SHA，已落后的任务被拒绝，应使用最新提交对应的任务发布。

## 发布结果验证与失败处理

本地验证和发布后的验证使用同一脚本，检查首页、深链接和不存在路径的 HTTP 状态。具体路径、预期状态码及重试参数以 [verify-deployment.mjs](./scripts/verify-deployment.mjs) 为准。

验证只检查 HTTP 状态，不检查页面文案、样式或交互。验证失败会使 CI 任务失败，但不会回滚已经完成的上传。处理失败时先查看失败步骤：

| 失败位置 | 检查方向 |
| --- | --- |
| `check` | 根据日志修正构建、类型、测试或部署配置；此时尚未上传网站 |
| 最新提交核验 | 旧提交应改用最新任务；GitHub 查询失败则检查请求错误日志 |
| 发布 | 检查 GitHub Secrets、Cloudflare 账户权限和 Wrangler 错误日志 |
| 地址验证 | 使用日志中的部署 URL 检查访问与路由；上传已完成，不能把任务失败当作未发布 |

参考：[Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)、[版本预览](https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/)。
