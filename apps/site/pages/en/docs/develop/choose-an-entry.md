# Choose Code, Agent or Workflow

Write one example input and describe the evidence that would satisfy the user. Make the choice per command.

| Business condition | Entry |
| --- | --- |
| The rule is known and repeatable | **Code** calculates a total, applies saved photo settings or writes bytes. Expose a deterministic operation as a Tool if an Agent should call it. |
| The path depends on the material | An **Agent** chooses what to do next using a goal, tools and a completion condition. For slides, the Agent chooses layouts and a tool writes the editable presentation. |
| Stages must occur in order | A **Workflow** can require a specification review before implementation and a validation step before delivering the patch. A stage can itself invoke an Agent. |
| A reusable package already does part of the job | Declare a **child Loom** in the parent manifest and call a named command from a Workflow. |

The host chooses the **Harness** (Mastra or OpenCode) that runs Agents. Authors specify model slots, capabilities and tools. An Agent can ask a clarification on its own. Use an explicit Workflow when the sequence belongs to the business contract. [Agents and tools](./components) · [Workflows and child Looms](./workflows)
