# Meeting Notes

A 0.5 Code entry reads one meeting source, invokes a structured Agent, verifies exact one-based source quotations and writes `meeting-notes.md`. Highlights reuse the same statements as the full minutes. The Agent's detailed rules are shipped as `editor.md` and loaded by an asynchronous instructions callback.

From the example's source directory, run `bun run typecheck` and `bun run build`. Archive the standalone `dist/` package with `npm pack`.

## Input and output

Supply either `{"prompt":"We agreed to roll out to 10% of users…"}` or `{"files":["/absolute/path/meeting.txt"]}`. `loom.yaml` declares exclusive prompt/file input, one `.txt` or `.md` file, and no folders. Strict UTF-8 file reading uses `context.fs.read`; malformed bytes fail rather than being replaced.

The Agent selects review, sync, exploration or action notes. Agenda-only, unrelated and insufficient sources call `context.reject` with a specific reason. Quotes must occur exactly on their claimed source line; this check establishes textual provenance, while semantic support is part of the Agent's instructions and needs model evaluation.

The declared Markdown `summary` is `meeting-notes.md`. `samples/` contains eight source records and one output illustration, including anonymous notes, mixed topics and a revised rollout proposal. The current CLI checks/builds the package. Archive-consumer tests use scripted Agent results to verify input handling, rejection, citation checking and rendering; they do not evaluate a live model.
