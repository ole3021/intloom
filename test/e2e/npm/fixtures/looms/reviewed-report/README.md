# Reviewed report

This deterministic Workflow writes a Markdown Artifact, waits for an explicit
review, and records an Acceptance bound to the saved candidate. The completed
draft is reused after restart. No model or credentials are needed.

With the framework installed in this directory or a parent directory:

```sh
intloom dev build
intloom loom describe ./dist/reviewed-report-1.0.0.tgz
intloom install ./dist/reviewed-report-1.0.0.tgz
intloom run reviewed-report@1.0.0 --input '{"title":"Delivery","body":"Ready for review."}'
```

The first run connects to the local Kernel or starts it automatically.
Use `intloom status RUN_ID` to see the question, file and quality. The Run waits for a review (exit 3 when leaving it pending). Read its `interaction list --run <runId>` and
`artifact list --run <runId>`, then inspect the file with `artifact read <id>`.
Replace placeholders with the IDs from those results. Submit a review with
`interaction respond <requestId> --value '{"approved":true}'`, watch the existing
Run to terminal, and query `status <runId>`.

The example permits human or program responses. Explicit JSON is recorded as
`program / cli`; omit `--value` to answer personally through the terminal prompt.
Its single criterion records the reviewer's decision. Approval yields quality
`passed`; `false` yields `rejected`, while execution still `succeeded`. The
observing CLI returns exit 5 for rejected quality. This is not automated prose
evaluation. Use `artifact export <id> --out report.md` to save the file locally.

Before framework publication, use the candidate's tarball overrides instead
of a registry install. Automated consumer verification submits `test / api`
responses; it does not claim a person approved these example reports.
