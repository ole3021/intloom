# intloom 网站

`@intloom/site` 是 intloom 官网与用户文档的前端应用，使用 Rspress 构建静态网站，通过 Cloudflare Workers Static Assets 提供访问。

本应用包含站点配置、构建与验证命令，以及自动发布所需的脚本和测试。GitHub Actions 支持生产版本和功能分支预览的发布。

网站采用纯静态部署，没有服务端运行入口。

首页公共样式、页面布局与模块样式使用 CSS Modules 分别维护，继续通过 CSS 变量共享设计值；KV 在 `components/key-visuals/` 自带样式。生产构建将首页样式独立分包，文档首次打开不加载首页及 KV 样式。

开发、配置和发布操作见 [开发维护指南](./DEVELOPMENT.md)；项目整体介绍见 [根 README](../../README.md)。

首页的四模块结构、工具用途、KV 理念与动效边界见 [设计与交互指南](./DESIGN.md)。启动本地网站后访问 `/` 查看唯一保留的首页版本。

正式首页由 `docs/index.mdx` 引用 `components/home/Home.tsx`，采用 D 的聚合 KV 与核心理念、点击切换的层叠开发产物、项目进度和编织动画。导航和四个模块按目录组织，组件与响应式样式放在一起。进度内容与核验日期在 `components/home/content.ts` 维护。
