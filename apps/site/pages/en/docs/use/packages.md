# Manage your Looms

Get an archive or a versioned package name from the author, together with its expected input, output and model or software requirements. For [file-report](../start/run), installing the archive with `intloom install ./file-report-0.4.0.tgz` makes it available from any directory using the same npm global prefix.

For a project-only installation, start in an npm project with `package.json`, place the archive there and run `intloom install ./file-report-0.4.0.tgz --project .`. Run `intloom run file-report` from that project to see the selected version and commands. Its installed copy takes precedence over a global copy. `intloom loom list` shows the service catalog.

To remove the project copy, use `intloom loom remove file-report --project .`. To remove the global copy, use `intloom loom remove file-report`. You can still find past deliveries using their run IDs.
