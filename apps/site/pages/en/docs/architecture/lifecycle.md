# Run lifecycle and delivery

Starting a command records a Run. It can execute, wait for a clarification or review, or finish. Use its ID with `intloom status RUN_ID` to query the latest state. A saved Agent clarification carries the original task and completed tool receipts. A Workflow can persist explicit waiting stages. After answering a pending request, inspect the same Run.

A file becomes retrievable by its artifact ID. When final review is requested, inspect the frozen candidate. An approved file becomes the delivery. A rejection can coexist with successful execution: the result records `deliveryStatus: rejected`, the candidate and optional reason. A revision is a separate Run. [Review from the CLI](../use/review)
