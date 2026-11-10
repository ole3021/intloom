# 一个 Loom 怎样运行

作者用 SDK 定义 Code、Agent、工具和 Workflow 步骤，用 `loom.yaml` 声明公开命令。作者机上的 Compiler 将执行模块和声明的资源打入 npm 归档。

CLI 安装包并准备所声明的子 Loom，从调用项目选择已安装命令。Kernel 校验输入和运行条件，创建 Run，管理交互和文件交付。Agent 使用宿主绑定的模型与 Harness。CLI 和 MCP 客户端都能回到同一份运行记录。[追踪一次交付](./lifecycle)
