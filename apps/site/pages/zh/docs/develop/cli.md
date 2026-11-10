# Loom 开发者 CLI 指南

| 任务 | 操作与预期结果 |
| --- | --- |
| 建立作者项目 | `intloom dev init ./hello --id hello` 在新目录或空目录生成 `package.json`、`loom.yaml` 和 `loom.ts`。 |
| 构建 npm Loom | 安装生成项目所需的依赖，或使用父级候选目录的依赖。在作者目录执行 `npm run build`，其脚本调用 `intloom-build`。 |
| 试用构建产物 | 在独立的消费项目执行 `intloom install ../hello/dist/hello-0.1.0.tgz --project .`，再用 `intloom run hello` 核对对外命令。 |
| 验证契约 | 执行 `intloom run hello hello --input '{"name":"Ada"}'`，导出文件并与 `Hello, Ada!` 比较，再提交一次错误类型的姓名验证输入检查。 |
| 排查失败 | 用 `intloom status RUN_ID --plain` 和 `intloom run events RUN_ID` 查看错误及过程。 |

完整目录顺序见[制作第一个包](../start/build)。`intloom init` 用于运行项目，`dev build/test/publish` 适用于[已有的编译归档项目](../reference/compatibility)。
