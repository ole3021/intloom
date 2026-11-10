# CLI command reference

See [Everyday CLI](../use/runs) for running packages and [Author CLI](../develop/cli) for developing them. Use `intloom COMMAND --help` for the available options. The table omits the executable name.

| Command | Scope and purpose |
| --- | --- |
| `install SOURCE [--project DIR]` | Install an npm package by name or archive, globally by default. Run from the project to prefer its copy. |
| `run NAME [COMMAND] [--input JSON] [--confirm-delivery]` | Show npm command usage by name alone. Run the selected command with input. Optionally request formal delivery review. |
| `status [RUN_ID] [--watch]` | Show unfinished and recent runs, or observe one run. |
| `loom list [--id ID]` · `loom describe ID` · `loom remove ID [--project DIR]` | Browse the service catalog, read an installed description, remove an installation. Static archive inspection with `loom describe FILE.tgz` is for compiled artifacts. |
| `dev init DIR --id ID` | Scaffold an npm Loom. Build it in the author directory with `npm run build`. |
| `dev build` · `dev test` · `dev publish --dry-run` | Build, test and preview an existing [compiled-artifact project](./compatibility). |
| `init [DIR]` | Create runtime project configuration. |
| `startup [--port N]` · `shutdown` | Start or observe the user service, or confirm cancellation and shutdown. |

## Runs and interactions

| Command | Use |
| --- | --- |
| `run SELECTOR [--input JSON]` | Create, start and observe until waiting or terminal. |
| `run create SELECTOR [--input JSON]` · `run start RUN_ID` | Separate creation from execution. |
| `run events RUN_ID [--after SEQ] [--limit N]` | Read events after a sequence number. |
| `run stop RUN_ID [--reason TEXT]` | Request cooperative cancellation. |
| `interaction list --run RUN_ID` · `interaction get REQUEST_ID` | Find the question and read its response history. |
| `interaction respond REQUEST_ID` | Prompt a person in a terminal. Add `--value JSON` to submit program input, or `--action decline` or `--action dismiss` to leave the question pending. |
| `run resume RUN_ID --request REQUEST_ID` | Continue with a saved answer. |
| `run resume RUN_ID --wait WAIT_ID [--value JSON]` | Continue a particular external or child wait. A child supplies its own result. |

## Artifacts and acceptance

| Command | Use |
| --- | --- |
| `artifact list --run RUN_ID` · `artifact get ARTIFACT_ID` | Discover files or inspect metadata. |
| `artifact read ARTIFACT_ID` | Write bytes to stdout. Use `--offset` and `--length` for a range. |
| `artifact export ARTIFACT_ID --out FILE` | Save a verified copy. Replacing an existing file requires `--overwrite`. |
| `acceptance list --run RUN_ID` · `acceptance get ACCEPTANCE_ID` | Inspect the recorded candidate, checks and conclusion. |

## Scripting

Pass inline JSON, `@input.json` or `@-` for stdin. Use `--plain` for one result envelope on stdout. Progress and diagnostics go to stderr. Paginated lists accept `--limit` and `--cursor`. A successful query exits 0 even when the Run it describes has failed.

| Exit | Meaning when running or observing |
| --- | --- |
| 0 | Successful execution or successful query/control operation |
| 1 | Failure, cancellation or interruption |
| 2 | Invalid arguments or input/answer validation |
| 3 | Waiting for a response or other continuation |
| 4 | Observer timed out |
| 5 | Execution succeeded with rejected quality |
| 130 | Observer or interactive prompt interrupted |

`status` is the global overview; `status RUN_ID` includes full details without `--details`. Run creation searches upward for `intloom.yaml`. For compiled artifacts, the package declares `storage: "global" | "project"`; default global, project without a detected project is an error. There is no public `--data-dir` or environment override.

`startup` stays in the foreground as an observer. Ctrl+C leaves the service running; use `shutdown` to stop it. `status` shows all unfinished Runs and the latest 10 finished Runs, without pagination or filters. `status RUN_ID --watch --timeout 30` observes one Run for up to 30 seconds.
