# 维护已有编译归档项目

项目若在 `loom.ts` 中默认导出 `defineLoom`，使用的是编译归档作者格式。依赖别名和 `loom.lock.json` 属于这套格式。在[已安装的本地候选目录](../start/setup)中可以运行随附的计算器：

```sh
intloom install ./looms/order-total-1.0.0.tgz
intloom run order-total@1.0.0 --input '{"prices":[19,23]}' --plain
```

预期业务输出是 `42`。在 `examples/order-total` 中，依次用 `intloom dev build`、`intloom dev test --input '{"prices":[19,23]}' --plain` 和 `intloom dev publish --dry-run --plain` 构建、试跑和预览归档。

候选包中的另一个例子 `reviewed-report` 会保存 Markdown 草稿，记录 Workflow 的业务审核，允许程序回答。npm Loom 的[最终交付确认](../use/review)需要人工答复。[开发新的 npm 包](../start/build)
