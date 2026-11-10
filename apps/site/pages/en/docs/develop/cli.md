# CLI for Loom authors

| Task | Action and result |
| --- | --- |
| Scaffold | `intloom dev init ./hello --id hello` writes `package.json`, `loom.yaml` and `loom.ts` in a new or empty directory. |
| Build an npm Loom | Install the generated dependencies (or use the installed candidate's dependencies) and run `npm run build` in the author directory. Its script invokes `intloom-build`. |
| Test the archive | In a fresh recipient npm project use `intloom install ../hello/dist/hello-*.tgz --project .`, then `intloom run hello` to inspect the public commands. |
| Check the contract | Run `intloom run hello hello --input '{"name":"Ada"}'`. Export its file, compare with `Hello, Ada!` and submit an invalid name to check validation. |
| Diagnose a failure | Use `intloom status RUN_ID --plain` and `intloom run events RUN_ID`. |

For the exact directory sequence see [the first package](../start/build). `intloom init` sets up a runtime project. `dev build/test/publish` are tools for [compiled-artifact projects](../reference/compatibility).
