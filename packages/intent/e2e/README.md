# Intent Workflow E2E suite

This directory owns Intent inputs, knowledge, model roles and optional business acceptance. The private root [E2E tool](../../../e2e/README.md) owns project setup and ordered CMD/MCP execution across CLI, Kernel and Workflow.

- `cases/S01`: one local task CLI Intent to exercise a complete flow.
- `cases/M01`: a completed basic-task Intent's workspace and formal history, followed by two Intents for editing/bulk controls and navigation/persistence/presentation. `baseline/provenance.json` identifies the real initial Intent and Run.
- `cases/L01`: ten Intents creating and evolving one empty operations project: intake, storage/CLI, cancellation, scheduling, completion, summary, filters, operator reports, export and documentation.

S/M/L describe iteration scenarios for this Workflow. They do not impose generic E2E limits. Later requirements become active when their Intent is submitted; the simulated user uses knowledge to answer relevant questions and preserve authorized earlier scope.

```sh
bun run e2e:cmd --root /absolute/e2e-root --case s01
bun run e2e:mcp --root /absolute/e2e-root --case m01
bun run e2e:cmd --root /absolute/e2e-root --case l01 --workflow @intloom/workflow-intent@VERSION
```

Configure model IDs in config.yaml or override `models` in an individual case.yaml. For example:

```yaml
models:
  cmd:
    reasoning: minimax-m3
  mcp:
    worker: glm-5.3-flash
```

The generic tool supplies Zen transport and uses the repository's single ZEN_API_KEY. This suite supplies the specific user/reasoning/coding/review/worker choices. Availability and success for a particular account or model require actual execution; no preset name implies comparative model quality.

`preparation.scripts: [checks/prepare.ts]` copies an optional case `baseline/intloom/` into the fresh CLI scaffold before Service startup. It preserves `store.json`, `artifacts/` and `records/` byte for byte, including versions and submission references. Cases without a baseline skip the copy. Business files belong in `workspace/`. Generate a baseline only from a completed first Intent with its Service stopped; retain provenance with the case. Do not copy `.intloom/`, configuration, credentials, dependency installations or locks. This initial preparation does not resume an old Run or restore a mirror. The default prepared baseline uses file Storage.

config.yaml accepts optional `limits` (execution duration, user/worker steps, command and connection timeout, connection retries). Limits are explicit, with no size-dependent budget table or financial tracking. See the root E2E README for precise semantics.

acceptance.md guides the simulated user's confirmation and result queries. The default has no mandatory scripted business verification. To enable the existing Intent-specific facts, add:

```yaml
acceptance:
  instructions: acceptance.md
  scripts:
    - checks/results.ts
```

The optional script reads each current Run's exact commit references before later iterations update Artifacts. It checks the four-stage Intent contract, confirmed bases and digests, original inputs and mirror integrity/boundaries; it queries earlier immutable Records directly. This deliberately stricter business policy belongs here and can be adapted independently. It does not grade the delivered code. Its own summary is written to the execution directory; it does not impose a global `--limit 50` query. `checks/facts.spec.ts` and performance helpers retain focused development regressions and are ordinary unit checks, not real-model E2E.

Add new cases as data directories with case.yaml (`intents`) and knowledge.md, plus optional workspace files/model overrides. No suite implementation or Kernel change is needed. Use `--suite DIRECTORY` for a different Workflow's E2E data.
