---
name: specification-analysis
description: Analyze the Intent and actual answers into concise requirements with verifiable acceptance criteria.
---
Read the current draft through read_specification. Preserve the original Intent's conditions and boundaries. Separate confirmed needs from assumptions; use clarification for facts that would change the requirements.

Keep existing identities. Organize domains by responsibility, features by user capability, requirements by observable behavior, and acceptance criteria by verifiable conditions and results. Constraints express boundaries; relations express dependencies, conflicts or refinement. State conflicts without inventing precedence. Deferred items preserve unanswered nonblocking questions and their impact.

Use edit_specification for only the objects being changed. Its schema defines editable fields; the Tool maintains history and cumulative changes. Include dependent new objects in the same edit. Edit an Acceptance directly when only it changes; when replacing a Requirement's editable content, preserve its still-required acceptances. Retire obsolete requirements and address affected references.

Use a short reason for each edit. Avoid repeating the same restriction across objects or creating filler. Do not convert implementation preferences or industry conventions into user-confirmed requirements.
