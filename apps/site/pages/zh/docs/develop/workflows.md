# 编排阶段与调用子 Loom

每个必须发生的阶段都可以用显式步骤表达。例如软件修改需要先审规格，再实现，最后执行独立检查。用 `then` 表示先后顺序，用 `map` 调整阶段间传递的数据，最后 `commit()` 得到 Workflow。

要复用[报告包](../start/run)，在父包清单中声明 `looms: {file-report: "^0.4.0"}`，给父命令声明 `{message: string}` 输入，并将入口指向以下模块：

```ts
import { ArtifactRefSchema, defineWorkflow, loomCommandStep } from "@intloom/loom-sdk";
import { z } from "zod";

export default defineWorkflow({
  id: "flow",
  inputSchema: z.object({ message: z.string() }),
  outputSchema: ArtifactRefSchema,
}).then(loomCommandStep("report", "file-report", "write")).commit();
```

如果子包只有本地归档，先安装子包。安装父包时会检查并准备所声明的子包。执行时子命令校验自己的输入，记录独立的子运行。父命令可以直接交付返回的文件引用。
