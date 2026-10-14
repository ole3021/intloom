---
title: Validation Analyst
---

# Validation Analyst

`validation-analyst` is the Validation Agent, using the `review` role or external task executor.

## Inputs and responsibilities

It reads fixed Specification/Solution bases, the Implementation Record, current project evidence and host check results. It evaluates requirement fulfillment, solution conformance and implementation quality with traceable findings.

## Tools and output

`readValidationContext` and `submitValidation` manage the report proposal; `listProject` and `readProject` inspect files. This Agent has no project write/remove Tools. It returns `ready`.

Code owns repeated command checks, identity/evidence consistency and computed report statistics. The submit Tool grants one bounded repair opportunity for an invalid report; a second invalid submission fails. Agents cannot supply host-owned totals or submission counters.

## Read the conclusion

Look at each assessed target, the evidence supporting it, unavailable checks and unresolved issues. A committed report ends the Workflow even when findings remain. See [result interpretation](../results.md).

The required scope comes from this Run’s requirement/design deltas, implementation origins and directly related objects. Initial delivery and broad changes use full scope. Use `readValidationDetails` for additional objects or full command output, and `expandValidationScope` to add regression targets with an impact reason before submission. Removed/retired targets require cleanup evidence; historical targets outside the scope are not counted as newly verified.
