# 交付文件与处理修订

用 Code 产出文件时，将输出 schema 设为 `ResultFileSchema`。在 `workDirectory(context.run)` 下写完文件，执行承诺的检查，然后返回 `resultFile(relativePath, mediaType)`。Kernel 固定这版文件，之后可通过文件编号取回。Workflow 可以交付子运行的文件，Agent 可以指定实际写文件的结果工具。

调用方可传 `--confirm-delivery` 请求最终确认。人工通过后交付已冻结的候选。拒绝后本次运行结束，结果保留候选和可选原因。若业务支持修改，提供接收原候选和修改要求的独立命令，在新运行里生成新文件。[以使用者身份审阅交付](../use/review)
