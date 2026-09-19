# TodoMVC — Implementation simulation

当前累计完成第 27 / 27 轮 Solution 输入。运行标识与上游相同。

在本目录执行：

- `bun install --frozen-lockfile`
- `bun run check`：类型检查、DOM/模块测试、浏览器构建。
- `bun run dev`：打开 http://127.0.0.1:4173 。

原生 TypeScript 实现；框架不受 Solution 限定，存储实现名选择 vanilla。

模块映射：

- OMOD-ui → src/ui.ts，页面、输入草稿和编辑会话。
- OMOD-store → src/modules/todo-state.ts，完整清单和派生展示。
- OMOD-router → src/modules/filter-router.ts，地址与分类选择。
- OMOD-storage → src/modules/todo-persistence.ts，完整快照保存。

工作流证据保存在 `workflow/`：每轮代码差异、输入摘要、实际检查日志与代码摘要。记录保存在上一级 `todo.records.ts`。这是顺序模拟执行，没有接入 Kernel；代码检查真实运行，不模拟通过。

保存失败会显示未保存提示，保留当前页面的编辑结果；未实现完整重试和恢复体验，对应 ORISK-storage-failure。

刷新不恢复待办显示，也不写入或清空旧存储。若新页面首次提交发现同名键已有非空数据，返回 previous-session 并保留旧数据，页面明确提示当前改动尚未保存；恢复、合并、替换策略仍属于 ORISK-post-refresh-write-policy，未冒充已经完成。该保护只覆盖本页首次提交，不提供多标签页并发协调。

作者/团队显示 IntLoom。所有数据留在当前浏览器，不发送给服务端。
