# Troubleshoot a run

| What you see | Next step |
| --- | --- |
| The commands look different | Run `intloom --version` and `command -v intloom`. In a candidate installation, repeat the PATH export in each new terminal. |
| npm cannot find the requested version | Use your team's registry or the matching [candidate bundle](../maintainers/candidate.md). |
| A Loom appears to do nothing | For npm Looms, the name alone prints usage. Pass a command and valid input. For project installations, run from the project that owns the package. |
| The input is rejected | Run the package by name to see required fields. Pass a JSON object with the expected field names and types or use `--input @input.json`. |
| A model or tool is missing | Check the package requirements against the [host configuration](../reference/configuration.md), including credentials visible to the service process. |
| A run is waiting | Use `intloom interaction list --run RUN_ID`. [Answer the request or review its candidate](questions-and-review.md). |
| The file is missing | List artifacts with the run ID and export the file by artifact ID. A rejected candidate is recorded in the run result. |
| Export refuses a path | Pick a new path, or explicitly add `--overwrite` to replace the existing file. |

When asking the author for help, include the CLI version, package name/version, run ID and error message. Remove credentials and private inputs.
