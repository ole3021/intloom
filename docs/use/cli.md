# Use the CLI for everyday work

Start with an [installed file-report Loom](first-loom.md). Run `intloom` in a terminal for the interactive menu, or use these commands directly.

| I want to… | Command |
| --- | --- |
| Find the commands in this package | `intloom run file-report` |
| Write a report | `intloom run file-report write --input '{"message":"First delivery"}'` |
| Find work after closing the terminal | `intloom status` |
| See what one run did | `intloom status RUN_ID` |
| Follow a run as it works | `intloom status RUN_ID --watch`. Ctrl+C leaves the run active. |
| Find a question and answer it | `intloom interaction list --run RUN_ID`, then `intloom interaction respond REQUEST_ID` |
| Retrieve the saved file | `intloom artifact list --run RUN_ID`, then `intloom artifact export ARTIFACT_ID --out ./report.txt` |
| Cancel active work | `intloom run stop RUN_ID` |

Use the actual IDs from the previous command. For longer inputs, save the JSON object to `input.json` and pass `--input @input.json`. For scripts, add `--plain` and read the JSON result on stdout. The [CLI reference](../reference/cli.md) lists exit codes, including 3 for a run waiting for an answer. [Manage installations](manage-looms.md) · [Review a delivery](questions-and-review.md)
