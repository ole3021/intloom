# Manage your Looms

Get the npm package name from the author, together with its expected input, output and model or software requirements. For [@intloom/meeting-notes](../start/run), installing the npm package with `intloom install @intloom/meeting-notes` makes it available from any directory using the same npm global prefix.

For a project-only installation, start in an npm project with `package.json`, run `intloom install @intloom/meeting-notes --project .`. Run `intloom run @intloom/meeting-notes` from that project to see the selected version and commands. Its installed copy takes precedence over a global copy. `intloom loom list` shows the service catalog.

To remove the project copy, use `intloom loom remove @intloom/meeting-notes --project .`. To remove the global copy, use `intloom loom remove @intloom/meeting-notes`. You can still find past deliveries using their run IDs.
