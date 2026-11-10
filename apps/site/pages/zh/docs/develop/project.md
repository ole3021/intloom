# 读懂作者项目

打开[第一个包](../start/build)生成的三个文件。

| 文件 | 修改什么 |
| --- | --- |
| `package.json` | npm 包名、版本、ESM 类型、依赖和构建脚本。脚手架使用 `intloom-build`。 |
| `loom.yaml` | 每个公开命令的作用、输入 JSON Schema、预期交付和相对入口路径。多个命令须指定 `defaultCommand`。 |
| `loom.ts` | 默认导出带自身输入输出 schema 的组件。问候示例把文件写入本次运行的工作目录，再返回文件引用。 |

对外输入与 SDK 入口的 schema 应相符。运行时使用的 npm 模块放入 `dependencies`，作者工具放入 `devDependencies`。按实际任务添加工具、模板和声明的资源。[清单字段](../reference/manifest) · [交付与修订](./delivery)
