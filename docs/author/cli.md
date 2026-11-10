# CLI for Loom authors

Use this checklist when iterating on an npm Loom with a `loom.yaml` manifest. The [first-package tutorial](first-package.md) shows the commands in working-directory order.

| Stage | Command | Evidence to inspect |
| --- | --- | --- |
| Scaffold | `intloom dev init ./hello --id hello` | The new or empty directory contains the manifest, SDK entry and npm metadata. |
| Build | `npm run build` from the author project with dependencies installed | The Compiler's `intloom-build` produces `dist/hello-0.1.0.tgz`. |
| Exercise the public contract | `intloom install ../hello/dist/hello-0.1.0.tgz --project .` from a separate npm project, then `intloom run hello` | The recipient sees the intended version, command, input and output description. |
| Run a positive and a negative case | `intloom run hello hello --input '{"name":"Ada"}'`, then repeat with `{"name":42}` | Inspect the exported greeting and the validation error. |
| Diagnose a run | `intloom status RUN_ID --plain`, `intloom run events RUN_ID` | Check the saved business result, error details, and any pending interactions. |

Rebuild after changing the manifest, code or packaged resources. Install the new archive into a fresh recipient project for a clean distribution check. `intloom init` creates runtime configuration. `intloom dev init` creates author source. The `dev build/test/publish` commands serve the [compiled-artifact format](../compatibility/compiled-artifact.md).
