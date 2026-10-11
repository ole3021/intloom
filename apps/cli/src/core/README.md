# CLI Core

Named client/local operations return `CoreResult<T>` JSON; observations yield JSON envelopes through async iterators. Core never prints, prompts, renders, or stores another execution state. It consumes Kernel Service schemas, uses fixed trusted loopback endpoints and retains request/instance/operation/Run identities on failure.

`index.ts` provides Service lifecycle, admission, queries, external Agent operations, SSE reconciliation and wait. Project/configuration/Workflow/MCP/log/diagnostic modules provide offline/local operations. File input for intent/answers belongs to CMD/TUI. Configuration inspection masks credentials; update uses an observed revision and takes effect on the next Service start.

Flow/answer require caller-owned instance and UUID. Writes are sent once. Unconfirmed transport results are `outcome: unknown`; callers explicitly inspect the original receipt. External Agent operations retain their own claim/owner/Tool receipt protocol. Abort signals control local observations only.

Initialization is compound and reports each step plus partial applied results. MCP plans include expected file hashes and recompute trusted target/content before applying. Unrelated configuration is preserved; conflicts are data/errors for the UI, never an implicit prompt.
