# Hello Loom

A 0.5 Workflow with three Code steps: ask a name, fetch nearby weather, and write `hello.md`. It needs no model. Ten locale sets cover English, simplified/traditional Chinese, Japanese, Korean, Spanish, French, German, Portuguese and Arabic.

From the example's source directory, run `bun run typecheck` and `bun run build`. The resulting `dist/` is a standalone npm package; run `npm pack` there to archive it.

The standard Loom input accepts an optional locale in `prompt` (for example, `{"prompt":"zh-CN"}`). Without it, the runtime locale is used. The name comes from `context.user.ask` in text mode with a Zod answer schema; blank or multiline answers keep the same question pending for retry. Weather comes from wttr.in with a five-second timeout and graceful fallback. Execution cancellation propagates through `context.signal` instead of becoming offline weather. Location is estimated from the runtime's network connection.

The greeting is the declared Markdown `summary`. Its onboarding section includes a localized source text for the Meeting Notes example. The current CLI checks and builds definitions; a runtime must supply user interaction and Workflow execution. The archived-package tests use scripted answers and weather responses.
