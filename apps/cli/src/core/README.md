# CLI Core

Named client/local operations return `CoreResult<T>` JSON; observations yield JSON envelopes through async iterators. Core never prints, prompts, renders, or stores another execution state. It consumes Kernel Service schemas, uses fixed trusted loopback endpoints and retains request/instance/operation/Run identities on failure.

`index.ts` provides Service lifecycle, admission, queries, external Agent operations, SSE reconciliation and wait. Project/configuration/Workflow/MCP/log/diagnostic modules provide offline/local operations. File input for intent/answers belongs to CMD/TUI. Configuration inspection masks credentials; update uses an observed revision and takes effect on the next Service start.

Flow/answer require caller-owned instance and UUID. Writes are sent once. Unconfirmed transport results are `outcome: unknown`; callers explicitly inspect the original receipt. External Agent operations retain their own claim/owner/Tool receipt protocol. Abort signals control local observations only.

Service requests validate the JSON envelope and its project, instance and request identities. Valid business errors retain their code, message and outcome, including HTTP 404. A non-JSON HTTP 404 from the expected API reports `CLI_SERVICE_PROTOCOL_MISMATCH`: check the CLI/Service versions and explicitly stop/start the Service if it needs reloading. This diagnosis does not identify a particular Service version. Malformed JSON, invalid envelope data or mismatched identities report `CLI_RESULT_INVALID`. HTTP rejection without a valid envelope reports `CLI_SERVICE_UNAVAILABLE`; a connection failure reports `CLI_SERVICE_OFFLINE`, and a request timeout reports `CLI_SERVICE_TIMEOUT`. The preceding status probe uses the same timeout/invalid-JSON classifications while retaining its saved-Service identity checks. These messages contain no response body or credentials.

After a write has been sent, an unconfirmed result remains `REQUEST_OUTCOME_UNKNOWN` with `outcome: unknown`. Its message includes the bounded transport/protocol diagnosis, and its metadata retains the original operation/Run references. Query that operation or Run before another submission; Core never retries the write or automatically restarts the Service.

Initialization is compound and reports each step plus partial applied results. MCP plans include expected file hashes and recompute trusted target/content before applying. Unrelated configuration is preserved; conflicts are data/errors for the UI, never an implicit prompt.
