# Package identity and scope

`package.json` supplies the npm name and version. `loom.yaml` supplies named commands, expected inputs, promised outputs and package requirements. Ordinary npm dependencies resolve at installation. Child Looms have their own packages and declared version ranges.

The CLI selects a project installation before a global one. A Run records the installed command identity. Delivered bytes have their own artifact IDs, so a later edit to a work file leaves the saved delivery available. [Manage installations](../use/packages)
