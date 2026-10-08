# Intent integration tests

These tests consume built package exports and exercise actual Runtime, Effector, Agent Tools, and Storage where specified. Source-level unit tests live beside their implementations in `codes/`, `schemas/`, `src/`, `tools/`, and `build/`.

Run from the repository root:

```sh
bun run test --filter=@intloom/workflow-intent
bun run test:intg --filter=@intloom/workflow-intent --concurrency=1
```

The integration task builds its required dependencies, including the CLI distribution used by installed-package tests. Those tests use npm for consumer installation and Node.js for execution.

## Directory organization

| Suite | Responsibility | Backends |
| --- | --- | --- |
| `package.intg.ts` | Export resolution, resource wiring, assets, declarations, test-file exclusion | None |
| `execution.intg.ts` | Specification initialization through commit, reopening, stale confirmations, rollback, post-commit failure, baseline refresh | File and SQLite |
| `interaction.intg.ts` | Clarification, feedback, Deferred repair, Run isolation and cancellation through public APIs | File |
| `recovery.intg.ts` | Specification clarification, confirmation, feedback, and reconfirmation after host restart without replaying model calls | File and SQLite |
| `storage.intg.ts` | Direct compiled Finalize retry after clear failure, retained State and transaction rollback | File and SQLite |
| `packed-package.intg.ts` | Isolated tarball installation, loading, declaration consumption and storage access | File and SQLite |

| Helper | Responsibility |
| --- | --- |
| `execution-fixture.ts` | Isolated projects, Specification-only compiled topology, controlled model transport, real backends, and execution instrumentation |
| `runtime.ts` | Independent in-memory State/Storage boundary double for unit tests |
| `specification-fixture.ts` | Prepared Specification drafts, proposals, and confirmation for source-level cases |
| `confirmation-fixture.ts` | Complete candidate data for confirmation-formatting tests |

## Coverage boundaries

Specification execution suites narrow the compiled four-Stage topology to Specification. The fixture also omits the full Workflow's `exclusive` setting so concurrent cases can exercise Artifact conflicts and per-Run isolation. These cases do not establish full Intent concurrency behavior or a complete Specification → Solution → Implementation → Validation execution.

Interaction rules run on one backend; storage-sensitive scenarios run on both. Package checks establish delivery and loading rather than replaying business scenarios. Direct Finalize tests preserve the repeat-call contract after State cleanup failure; Runtime does not retry failed Runs.

Interaction cases cover exact user replies, immutable blocking policy, skipped uncertainty with its Deferred, repair without repeating a skipped question, and follow-up questions retaining earlier answers. Recovery cases repeat safe Specification waits across restarts. Solution has focused patch and Finalize unit tests; Implementation and Validation have focused rule tests. Later-Stage interaction, host-command execution, complete handoff/persistence, and full-Workflow exclusivity need dedicated integration coverage.

Controlled model transports and simulated user replies establish exercised execution contracts, not live model quality or actual Codex UI acceptance. Unicode and surrounding whitespace in fixtures deliberately exercise preservation of user text. See [business rules](../src/README.md) and [distribution preparation](../build/README.md) for implementation boundaries.
