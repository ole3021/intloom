# Intent Loom E2E

This suite belongs to `@intloom/intent`. The [CLI runner](../../../apps/cli/src/e2e/README.md) owns generic execution; these cases own requirements, user knowledge and independent checks for the current four-stage design.

```sh
intloom build ./packages/intent
intloom e2e ./packages/intent --list
intloom e2e ./packages/intent --case S01 --root /absolute/e2e-results
intloom e2e ./packages/intent --case M01 --entry mcp --root /absolute/e2e-results
```

Export `INTLOOM_E2E_MODEL`, `INTLOOM_E2E_API_KEY` and `INTLOOM_E2E_BASE_URL`, or pass `--profile` with separate user/service/worker model settings. No credentials belong in the suite. CMD is the default. E2E uses existing build output and does not rebuild it.

- **S01** creates a small persistent task CLI in one Run. It verifies full delivery, independent implementation/validation execution, four immutable Records, three Artifacts and confirmation/handoff evidence.
- **M01** starts fresh and executes two real Runs. The first creates add/list/complete/reopen. The second adds list filtering, changes its default and removes reopening. It verifies retained history, adjusted/retired requirements, round-only removal criteria and cumulative validation. Second-round knowledge is withheld from the first simulated-user session.

Both are full-delivery success cases. Partial delivery or ending collection with unverified targets is not authorized. Such outcomes block/fail these cases rather than being silently approved. This expectation belongs here, not in the generic Runner; future negative cases can expect truthful failed/partial/undone validation.

`checks/contracts.mjs` validates exact public result references, Record digests, confirmed snapshots, same-Run bases, plan coverage, candidate identity and positive evidence. `checks/history.mjs` checks prior Record immutability, Artifact bases, cumulative publication order, version-qualified targets, latest unknown outcomes and historical finding updates. These scripts run after every round by default. They do not import CLI internals, prefill formal storage or substitute historical evidence for the current execution.

The former M01 baseline and legacy L01 are removed from the active catalog. Every formal history entry now originates in this attempt. Longer and exceptional scenarios can be added as separate cases after the two main cases are validated. The checks assess the Loom process and formal evidence; they do not claim comprehensive application or visual quality.

Oracle regression tests run with the Intent package's ordinary `test` script. CLI infrastructure tests use their own generic Loom. Neither those controlled tests nor package builds establish successful live-model S01/M01 execution; retain the actual E2E reports when running them.
