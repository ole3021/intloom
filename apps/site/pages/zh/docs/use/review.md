# 回答问题或确认一份文件

有的运行会停下来补问信息。先执行 `intloom interaction list --run RUN_ID`，再执行 `intloom interaction respond REQUEST_ID`。在终端回答原请求后，同一次运行会继续。普通问题的回答策略可以允许程序作答。

若希望先审阅交付的文件，用 `intloom run file-report --input '{"message":"Review this note"}' --confirm-delivery` 启动[已安装的示例](../start/run)。进入等待状态后，通过运行编号找到请求。执行 `intloom interaction get REQUEST_ID` 查看审阅材料，打开候选文件，再回到交互终端作出决定。

**通过**会交付刚才查看的那一版，**稍后决定**会保留请求，**拒绝**会结束本次运行并保留候选文件和填写的原因。若作者提供修改命令，将原候选作为输入发起新运行。正式交付确认需要人操作。已有归档格式的 Workflow 还可以定义允许程序回答的[业务审核](../reference/compatibility)。
