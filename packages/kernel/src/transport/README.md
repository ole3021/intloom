# Transport

HTTP/JSON, SSE, MCP and IDE interaction adapters parse protocol input and call Operations. They do not own Run state, operation deduplication, Calls, Agent receipts or storage transactions.

Mutation requests bind a trusted source and Service instance. Responses distinguish the operation receipt from the current Run view. A connection timeout or disconnection never stops a Run and never triggers automatic mutation replay. Closing SSE only releases its observer. Agent completion returns a submission receipt, followed by a separate Run query.

Human-form presentation preserves the original action identity and exact answer. A dismissed form leaves the Run waiting. Only an explicit stop operation cancels execution.
