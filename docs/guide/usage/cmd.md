---
title: CMD operation guide
---

# CMD operation guide

CMD is useful for explicit operations, file input, and scripts. It accepts complete execution arguments and returns promptly; use separate observation and answer commands.

## Input and output

```sh
intloom flow intent --intent-file ./request.txt --json
intloom flow intent --intent-file - --json
intloom status --json --no-color
intloom logs RUN-example --follow --json
```

The stdin example expects intent text piped into the command. `--intent` preserves the complete string; `--intent-file` cannot be combined with it.

Without `--json`, CMD prints readable summaries and tables even when redirected. `--json` emits one `CoreResult` object for ordinary operations; streams emit JSON Lines. Logs and diagnostic stderr remain separate from machine stdout.

## Automate deliberately

Check `ok` for the command and `status` for the Run. A successful admission or answer may leave the Run running or waiting. A query of a failed Run can exit nonzero, while successful cancellation exits zero.

Retain request identities for uncertain writes. The client does not automatically retry execution. A watcher reconnects by reading state rather than replaying `flow`.

`--project` chooses an exact project root. Artifact export paths still use your shell's working directory. `--no-interactive` disables lightweight setup selection; it does not answer Workflow questions.

Use [Run operations](./runs.md), [results](./results.md), and the complete [command reference](../reference/cli.md).
