# Answer a question or review a delivery

A run can pause to ask for missing information. Find it with `intloom status`, list its requests with `intloom interaction list --run RUN_ID` and answer with `intloom interaction respond REQUEST_ID`. For a child run's request, use the request ID shown. The answer continues the original work. Ordinary questions can accept program input according to their response policy.

## Review the exact file

With [file-report installed](first-loom.md), ask to review the result before delivery:

```sh
intloom run file-report --input '{"message":"Review this note"}' --confirm-delivery
```

At the wait, record the run ID. Use `intloom status RUN_ID` and `intloom interaction list --run RUN_ID` to find the request. `intloom interaction get REQUEST_ID` shows its review material. Open the candidate in the review prompt or export its artifact ID to inspect it. Use `intloom interaction respond REQUEST_ID` in an interactive terminal and choose a decision.

- **Approve** delivers that frozen version.
- **Defer** leaves the request pending so you can return to it.
- **Reject** finishes the run with a rejected delivery. The result retains the candidate and any reason you supplied. If the Loom offers a revision command, pass it the candidate explicitly to start a new run.

A formal delivery approval requires a human response channel. A scripted `--value` can answer eligible questions. An individual Workflow may also implement a business review with its own answer policy.
