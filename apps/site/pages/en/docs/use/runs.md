# Everyday CLI

After [installing @intloom/meeting-notes](../start/run), run `intloom` in an interactive terminal to browse installed Looms and recent runs. Use the following commands directly when you know your task.

| I want to… | Command |
| --- | --- |
| See which inputs the package accepts | `intloom run @intloom/meeting-notes` |
| Summarize a UTF-8 meeting transcript | `intloom run @intloom/meeting-notes summarize --files ./notes.md` |
| Find a run after closing the terminal | `intloom status` |
| Follow the run | `intloom status RUN_ID --watch` |
| Answer a question | `intloom interaction list --run RUN_ID`, then `intloom interaction respond REQUEST_ID` |
| Save a copy of a file | `intloom artifact list --run RUN_ID`, then `intloom artifact export ARTIFACT_ID --out ./meeting-notes.md` |
| Stop active work | `intloom run stop RUN_ID` |

Replace uppercase IDs with the values you see. Ctrl+C in a watch closes the observer and the run continues. `--input @input.json` reads a UTF-8 JSON file. `--plain` gives scripts JSON on stdout. [Questions and review](./review) · [Command reference](../reference/cli)
