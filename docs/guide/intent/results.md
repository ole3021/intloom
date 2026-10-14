---
title: Understand Intent results
---

# Understand Intent results

Read the saved objects alongside the Run's actual commit references.

| Object | What to inspect |
| --- | --- |
| Specification Artifact | Confirmed requirements, targets and acceptance |
| Specification Record | Changes, feedback and actual question/confirmation history |
| Solution Artifact | Confirmed design, decisions, risks and scenarios |
| Solution Record | Design changes, feedback and agreed checks |
| Implementation Record | Actual changed files, origins/hashes and command evidence |
| Validation Artifact | Target assessments, findings, evidence and computed statistics |

```sh
intloom artifacts --flow intent
intloom records --flow intent
intloom artifact --flow intent --stage validation
```

Use actual IDs to inspect detailed Records. They are separate business IDs and should not be inferred from the Run ID.

## Interpret completion

`completed` means the Validation report was committed and the Workflow reached its end. Read which targets were checked, which passed, what evidence supports them, and which checks were unavailable or incomplete.

A successful build does not establish runtime behavior, model quality, a deployment, or publication. An Agent claim needs supporting evidence. Validation statistics are computed by Code rather than accepted as proposal totals.

Later Runs may replace current Artifacts. Use revisions from the original Run to identify the result you are assessing. Failure after earlier stages preserves their successful commits and project changes.

See [result queries and export](../usage/results.md).

Interface and scenario-step changes are assessed under their owning module or scenario; references to nested objects do not escape required coverage.

Validation reports identify this Run’s scope and selection reasons. Unchanged historical targets outside that scope have not been revalidated. A previous passing result is tied to its original Run and source versions; it is not evidence for the current code.
