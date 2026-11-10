# Answer a question or review a file

Some runs pause for information. Use `intloom interaction list --run RUN_ID`, then `intloom interaction respond REQUEST_ID`. Answer the original request in the terminal to continue the same run. An ordinary question can accept a program response if its policy allows one.

To inspect the exact file before accepting it, start the [installed example](../start/run) with `intloom run @intloom/meeting-notes summarize --files ./notes.md --confirm-delivery`. At the wait, find the request using the run ID. `intloom interaction get REQUEST_ID` shows the review material. Inspect the candidate, then respond in an interactive terminal.

**Approve** delivers the frozen version. **Defer** leaves it waiting. **Reject** retains the candidate and optional reason and ends this run. If the author provides a revision command, pass it the candidate to start a new run. Formal approval requires a human interaction. A compiled-artifact Workflow may define a separate [business review](../reference/compatibility) that accepts program input.
