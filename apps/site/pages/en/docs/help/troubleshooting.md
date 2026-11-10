# Troubleshoot by symptom

| What you see | What to check next |
| --- | --- |
| A global CLI rejects a command in this guide | In the candidate directory, check `command -v intloom` and `intloom --version`. Put its `node_modules/.bin` first on `PATH` in both terminals. |
| The package is missing or the version is unexpected | Run `intloom run file-report` from the owning project. Check its npm installation or install the archive globally. |
| A name and version match more than one build | Inspect the entries from `loom list` and select the intended artifact digest. |
| The report command exits 3 | Read `status RUN_ID` and `interaction list --run RUN_ID`. Read the draft and submit a decision. |
| An answer is saved but work has not continued | Check the receipt, `status RUN_ID` and any `recoveryIssue`. Restore the original environment, then resume with the saved request ID. |
| Watching exits 4 | The observer timed out. Query the same Run before deciding what to do. |
| Executing a compiled-artifact review returns 5 | Read `status RUN_ID` and the selected acceptance report to see which criterion was rejected. |
| Artifact export refuses the destination | Pick another path, or pass `--overwrite` if replacing the existing file is intended. |

## Collect a reproducible report

Include the CLI version, exact Loom reference, Run ID, state, relevant events, and the code and message from the failing operation. For a review problem, add the request or acceptance ID. Remove credentials and private business data before sharing diagnostics.
