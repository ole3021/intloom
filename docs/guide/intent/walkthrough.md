---
title: A feature-development round
---

# A feature-development round

This example describes the intended interaction for a Todo feature. It is a usage walkthrough, not an executed E2E result. Prepare your project, installed Intent package and model/client setup first.

```sh
intloom run intent --prompt "Build a Todo app with local persistence. Users can create, complete, rename and delete tasks. Support narrow screens."
```

1. **Clarify and confirm requirements.** Answer questions about behavior. Review features, requirements, observable acceptance conditions and this round's scope. A later bug fix may reuse these requirements unchanged.
2. **Confirm the solution.** Review affected modules and interfaces, implementation dependencies, risks and verification methods. Check which work runs during Implementation, Validation or both.
3. **Review delivery when needed.** Implementation changes actual files and collects receipts. If it cannot complete the agreed work, review the exact remaining items before explicitly choosing partial delivery or continuing work.
4. **Read the validation report.** Inspect each target's evidence and judgment. Missing evidence stays unverified. A valid failed report is still a completed report.
5. **Start the next round deliberately.** Add or adjust a feature, or fix a reported problem in a new Run. Its stages distinguish intended requirements/design from actual code and preserve historical assessment versions.

Use `intloom runs` and `intloom attach <run-id>` to inspect the original Run after a disconnect. Earlier results and file changes remain after cancellation; starting another Run is not a rollback.
