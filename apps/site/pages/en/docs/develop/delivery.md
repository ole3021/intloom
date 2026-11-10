# Deliver a file and handle revisions

For a Code entry writing a file, declare `ResultFileSchema` as its output schema. Write the bytes under `workDirectory(context.run)`, perform the promised checks and return `resultFile(relativePath, mediaType)`. The Kernel fixes that version for retrieval by artifact ID. A Workflow can return a child delivery, and an Agent can use a declared result tool.

A caller may request final review with `--confirm-delivery`. Human approval delivers the frozen candidate. On rejection the Run ends, and the result retains the candidate and optional reason. If revisions belong to the product, expose a command accepting the original candidate and the requested changes. Produce a new file in a new Run. [Review the result as a user](../use/review)
