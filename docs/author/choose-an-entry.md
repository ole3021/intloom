# Choose how a command runs

First write a sample request and an observable success condition. Decide which decisions the implementation must make and which operations must be repeatable.

| If the business requires… | Use | Example |
| --- | --- | --- |
| Known rules and a repeatable result | `defineCode` | Calculate a total, apply a saved photo profile, write text to a file. |
| Choosing the next action from the material | `defineAgent` with declared tools and a completion condition | A slide author chooses layouts. A tool writes the editable slides and returns the file reference. |
| Stages in a required order or approval between phases | `defineWorkflow` with explicit steps | Review a specification before implementation, run the agreed checks, then deliver a patch. A step can use an Agent. |
| An independently versioned capability shared by multiple packages | Declare a child in `looms` and call a named command | A parent Workflow delegates to a report writer and returns its saved file. |

The official [meeting-notes example](../../examples/meeting-notes/README.md) uses a Code entry for source-file reading, quotation checks and Markdown delivery. It calls one structured-output Agent to classify the meeting and extract supported facts. Its summary and full minutes use the same statements.

**Harness is a host setting.** A Loom specifies the model slot and capabilities it needs. The host selects Mastra or OpenCode to execute an Agent. A pure Agent can use tools and ask ordinary clarification questions. Add a Workflow when a sequence or checkpoint belongs to the business contract. A request for final file confirmation can also be made by the caller.

One package can expose several commands with different entries. For instance, learning a photo style can need an Agent, while applying the learned parameters is deterministic Code. The host checks package-wide model requirements before running a command. [Agents and tools](agents-and-tools.md) · [Composition](workflows-and-child-looms.md)
