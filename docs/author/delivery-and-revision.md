# Deliver and revise a file

Write intermediate files under `workDirectory(context.run)`. For a deliverable, finish writing the file, run the business checks and return `resultFile(relativePath, mediaType)` with `ResultFileSchema` as the component output. A tool-backed Agent can return its result tool's output; a parent Workflow can forward the child's immutable reference.

The Kernel saves the delivered bytes with an artifact ID. Verify the promise at the consumer boundary: reopen a generated document, apply a patch and run its checks, or compare exported text with the expected value.

If the caller sets `--confirm-delivery`, the Kernel freezes a candidate and asks a human to decide. Approval delivers the same reference. Rejection ends that Run with `deliveryStatus: rejected` and retains the candidate and optional reason. A package that supports revisions should expose a separate command with the original candidate and requested changes as inputs. Produce a new result in a new Run. Keep the old reference usable. [Review from the terminal](../use/questions-and-review.md)
