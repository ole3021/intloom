---
name: specification-review
description: Review requirement semantics, acceptance criteria, and feedback handling before deterministic checks and actual user confirmation.
---

# Review before submitting for checks

Check that each edit's target, reason, and actual impact agree and that requirements preserve the original Intent's restrictions and acceptance meaning. Check object references, active status, acceptance ownership, and stable IDs.

All questions must have an actual answer or skipped=true. Questions with isBlock=true require answers and cannot be skipped. isBlock is the question's fixed skip permission and does not need to be cleared after answering. A skip means the user responded; do not ask the original question again in this Run. The draft must contain a corresponding Deferred change for this Run, preserving unknowns without fabricated answers. If an answer is insufficient, retain the original question and answer and add a specific new question. Reflect user feedback in the draft.

Use edit_specification for changed objects, then submit_specification to finish analysis. Return clarification_required when more user input is needed; otherwise return ready for Check Code to validate structure, patches, IDs, references, questions, and feedback.

Submit once successfully per invocation, then return only the outcome JSON. saved=true means State was saved, not that Check passed. Do not reread or resubmit to self-check after success; wait for the next invocation with actual Code feedback. On that invocation, edit only the affected objects; Tools preserve accepted earlier changes.

When Check fails, Code adds diagnostics with source=check and returns repair_required, routing back to Analyze. The model neither generates these diagnostics nor returns repair_required. Successful checks create an independent confirmation snapshot containing the original Intent, Changes, actual answered questions, feedback, and baseline version.

Confirm Code presents the complete snapshot and records the actual user response; a declined confirmation returns to analysis with original feedback. Any draft change removes prior confirmation. Finalize revalidates the snapshot, baseline version, and deterministic rules, then commits the Artifact and Record together. Model ready, Tool success, or no response must never count as confirmation.
