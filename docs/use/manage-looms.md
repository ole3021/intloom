# Manage installed Looms

Ask the author for the archive or npm package name, a sample input, the expected result and any model or software requirements. Loom code executes on the machine running the service. Use a package from an author you trust.

| Task | What to do |
| --- | --- |
| Use a package across projects | Install its archive with `intloom install ./file-report-0.4.0.tgz`. npm uses its global installation prefix. For a published package you can also pass its npm name and version. |
| Keep a version with one project | From a project containing `package.json`, run `intloom install ./file-report-0.4.0.tgz --project .`. Run the Loom from that project. The CLI selects its installation before a global one of the same name. |
| See what this copy offers | Run `intloom run file-report` from the directory where you plan to use it. Read the selected version, command names and expected inputs. `intloom loom list` shows the service catalog. |
| Remove a copy | Use `intloom loom remove file-report --project .` for the project copy, or `intloom loom remove file-report` for the global one. Previously delivered files remain accessible by ID. |

The installation scope selects **which code runs**. Each invocation receives its own run ID. Use [the everyday CLI](cli.md) to find the history and files later.
