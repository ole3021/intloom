---
title: Loom design principles
---

# Loom design principles

A Loom organizes the goals, judgment, operations, human decisions, and formal results of a kind of work into a repeatable process. A well-designed Loom advances the current task and preserves facts that later work can understand and use.

This guide describes responsibilities and design methods for Loom authors. `@intloom/loom-sdk` owns the concrete interfaces; each business Loom owns its stage and data contracts. Intent's four stages are one application, not a required template for every Loom.

## Define business contracts before execution steps

Before writing Agent instructions, Skills, or Stage YAML, answer these questions for each stage. Confirm choices about user goals, business boundaries, and formal results with the person requesting the work.

| Contract | What to specify |
| --- | --- |
| Purpose | The problem this stage solves and its explicit boundaries |
| Inputs | User input, upstream formal results, and existing project facts; required versus on-demand context |
| Business outputs | What this round creates or changes, and how drafts differ from formal results |
| Completion conditions | Required checks, human confirmation, and sufficient evidence of completion |
| Handoff rules | The versions, unresolved matters, and guarantees the next stage receives |
| Failure and waiting | Missing input, rejected confirmation, cancellation, business failure, and execution faults |

An Agent response does not establish stage completion. Completion should correspond to observable business conditions and the required commits.

A Loom declares the inputs it needs from the SDK's `prompt`, `files`, `dirs`, and `urls` types. Business preferences and constraints belong in inputs and subsequent business outputs; the host manages models, connections, and execution environments.

## Assign each responsibility to its owner

| Component | Owns | Should not own |
| --- | --- | --- |
| Agent | Role, purpose, boundaries, judgment, and quality criteria | Storage protocols, version calculations, or the entire stage routing process |
| Skill | Reusable methods, applicability, criteria, and useful examples or references | Current execution state, formal commits, or host permissions |
| Tool | A meaningful business operation, its inputs, effects, errors, and boundaries | A repeated manual for the whole stage |
| Schema | Data shape, field meaning, enumerations, and structural constraints | Routing, real execution evidence, or business correctness across objects |
| Code | Context preparation, deterministic calculations, fact checks, human interaction, execution checks, and commits | Unauthorized decisions or treating valid structure as correct business content |
| Stage / Step | Order, branches, capabilities, handoffs, and bounded correction | Hiding essential control flow in role instructions |

Concise role instructions are only part of an Agent Step: it also binds a model purpose, Tools, Skills, and an output contract. Keep business roles separate from model purposes: roles describe work; `thinking`, `working`, and `coding` express a preference for a general host-configured model purpose.

Skills should retain concrete methods. A clarification Skill can teach how to distinguish facts, assumptions, and unanswered questions; an assessment Skill can explain evidence sufficiency. Business concepts belong in these methods. Internal Artifact serialization, Record IDs, and commit transactions should not dominate them.

Put caller-relevant constraints in Tool descriptions or Schema field descriptions. Code should calculate deterministic values such as versions, hashes, statistics, and provenance. Business references and reasons for a change still need to come from an actor that understands the task.

## Make the process explicit

Split a Step when the next task needs different context, capabilities, outputs, or a human decision. Do not add a model call for every field, Tool call, or reasoning action. Stages need not have identical numbers or kinds of Steps.

A common sequence is context preparation → Agent proposal → Code validation → required human confirmation → commit. Represent clarification, correction, and failure as explicit branches. Tasks that require no model judgment can be entirely Code-based.

Grant capabilities according to the task. An assessment Step normally needs reading and assessment Tools; a product implementation Step needs write capabilities. A prohibition in role instructions does not replace capability configuration.

Corrections need actionable feedback, bounded attempts, and stopping conditions. Distinguish correctable proposal errors, business failures, and execution faults. Repeated retries or weakened checks must not manufacture completion.

## Separate proposals, working state, and formal results

Agents submit business proposals; Code turns them into trustworthy formal data. An editing Tool can expose only editable fields instead of reusing a complete persistence model. Known context and return shapes should have explicit Schemas.

- **State** holds temporary stage work, including drafts, frozen bases, feedback, and waits.
- **Record** holds formal facts from one business execution. Later runs should not rewrite its contents.
- **Artifact** holds a current formal result or accumulated view with identifiable sources.

Choose outputs according to the business. Not every stage needs both an Artifact and a Record. Handoffs use deliberate formal results and their identities and versions, rather than another stage's temporary State.

Actual interactions and operations produce human answers, confirmations, command results, and file facts. Model assertions cannot replace them. Confirmation must bind a specific candidate and its basis; substantive candidate changes require renewed checking and confirmation.

## Explain history and validity in accumulated results

For long-lived state, a Loom can save each round's Record and derive an Artifact from an explicitly ordered sequence of Records. The business Loom owns the merge rules. Concatenating reports or silently replacing all history with the latest round is insufficient.

Define:

- Stable object identities and how new results update an existing object.
- How objects outside the current scope retain historical conclusions.
- Which changed assumptions or implementations require reassessment, including conservative handling of unknown impact.
- How findings close and how removed or retired objects retain understandable history.
- Which conclusions belong to this round, which are historical, and what the statistics cover.

For example, a feature that passed in an earlier round but was not assessed this round retains a historical result. A related implementation change requires considering whether that result still applies. Omitting an old finding from a new report does not resolve it.

When an Artifact is derived from Records, preserve the ability to rebuild it from the complete record sequence. Commit the Record and corresponding Artifact update in one Storage transaction, handling duplicate submissions and version conflicts. Project file changes and external effects are outside that transaction and need their own failure and recovery boundaries.

## Match completion claims to evidence

Structural validity, engineering checks, business fulfillment, and overall quality are different judgments. A valid Schema does not prove a sound requirement; a passing command does not prove every acceptance condition.

An assessment stage can successfully complete a report whose conclusions include failure, partial fulfillment, or insufficient evidence. Distinguish completion of the assessment from success of the assessed work. An interrupted execution without a valid business result should retain diagnostics without inventing a formal conclusion.

Evidence should identify real objects, operations, or results, including the relevant version and coverage. Preserve uncertainty when evidence is unavailable.

## Let source organization reflect responsibility

Put the Loom definition in the `loom` field of `package.json` and colocate each stage's resources. Promote logic into root `src/` only when it is actually shared across stages and has a stable responsibility.

```text
package.json                 # Loom metadata, inputs, and stage topology
src/                         # Shared logic and contracts
stages/
  <stage>/
    stage.yaml               # Step routing and capability bindings
    agents/                  # Role instructions
    skills/                  # Reusable methods and references
    tools/                   # Agent-callable business operations
    schema/                  # Context, proposal, state, and output contracts
    codes/                   # Executable Code Steps
    src/                     # Stage business rules and helpers
```

Create directories only as needed. Authors build packages with `intloom build [path]`, using the current directory when the path is omitted. Users manage built packages through `intloom loom`. Building, installing, and executing have separate responsibilities.

Extend the concrete Loom first. Consider an SDK capability when several real use cases need it; do not impose one Loom's business model on every other Loom.

## Definition references

These IntLoom principles draw on [OpenAI's Agent definition](https://developers.openai.com/api/docs/guides/agents/define-agents#what-belongs-on-an-agent), [OpenAI Skills](https://developers.openai.com/api/docs/guides/tools-skills), [OpenAI Tool contracts](https://developers.openai.com/api/docs/guides/function-calling#defining-functions), [Anthropic Skills](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview), and [Anthropic's distinction between workflows and agents](https://www.anthropic.com/engineering/building-effective-agents). Each Loom defines its own concrete commit, accumulated-view, and handoff rules.
