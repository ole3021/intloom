# 编排阶段与调用子 Loom

每个必须发生的阶段都可以用显式步骤表达。例如软件修改需要先审规格，再实现，最后执行独立检查。用 `then` 表示先后顺序，用 `map` 调整阶段间传递的数据，最后 `commit()` 得到 Workflow。

要复用[会议纪要包](../start/run)，在父包清单中声明 `looms: {"@intloom/meeting-notes": "1.0.1"}`，给父命令声明 `{prompt: string}` 输入，并将入口指向以下模块：

```ts
import { ArtifactRefSchema, defineWorkflow, loomCommandStep } from "@intloom/loom-sdk";
import { z } from "zod";

export default defineWorkflow({
  id: "flow",
  inputSchema: z.object({ prompt: z.string() }),
  outputSchema: ArtifactRefSchema,
}).then(loomCommandStep("report", "@intloom/meeting-notes", "summarize")).commit();
```

安装父包时，安装器会检查所声明的子包，按需从 npm 安装指定版本的 `@intloom/meeting-notes`。执行时子命令校验自己的输入，记录独立的子运行。父命令可以直接交付返回的文件引用。
