# intloom 网站

`@intloom/site` 是 intloom 官网与用户文档的前端应用，使用 Rspress 构建静态网站，通过 Cloudflare Workers Static Assets 提供访问。

本应用包含站点配置、构建与验证命令，以及自动发布所需的脚本和测试。GitHub Actions 支持生产版本和功能分支预览的发布。

网站采用纯静态部署，没有服务端运行入口。

开发、配置和发布操作见 [开发维护指南](./DEVELOPMENT.md)；项目整体介绍见 [根 README](../../README.md)。
