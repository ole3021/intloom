# IntLoom

IntLoom lets you install a professional capability as a **Loom**, give it input and collect its result. A report writer, for example, can take a message and deliver a text file. Each run gets an ID so you can return to a question, check progress or retrieve the exact file that was delivered.

[0.4.0 documentation](docs/README.md) · [Use a Loom](docs/use/cli.md) · [Build a Loom](docs/author/first-package.md) · [Develop with a coding agent](docs/ai/loom-authoring.md)

## Try a Loom

With the CLI installed and a built file-report archive in the current directory:

```sh
intloom install ./file-report-0.4.0.tgz
intloom run file-report --input '{"message":"First delivery"}'
```

Use the returned file reference with `intloom artifact export <artifactId> --out ./report.txt`. [Get the sample archive and run your first Loom](docs/use/first-loom.md).

| If you want to… | Start here |
| --- | --- |
| Turn meeting text or a file into highlights and source-backed minutes | [Official meeting-notes example](examples/meeting-notes/README.md) |
| Run a Loom from a terminal, answer questions or automate a command | [IntLoom CLI](apps/cli/README.md) |
| Install and execute a Loom from the desktop run center | [IntLoom Studio](apps/app/README.md) |
| Browse the Loom directory and bilingual guides | [Website](apps/site/README.md) · [中文指南](apps/site/pages/zh/docs/index.md) |
| Write a Code, Agent or Workflow command and package it for others | [Loom SDK](packages/loom-sdk/README.md) · [Compiler](packages/compiler/README.md) |
| Embed execution, interactions and artifact storage in a host | [Kernel](packages/kernel/README.md) |

## Develop and verify

Use Node 26.13.0 and Bun 1.4.4 for this checkout.

```sh
bun install --frozen-lockfile
bun run verify
```

Use `bun run test` for daily regression, `bun run test:intg` for configured live tasks and `bun run test:e2e` to verify the npm archives in isolated installations.

See [development and verification](docs/maintainers/development.md) for the developer CLI, supported consumer runtimes and candidate packages. Read versioned changes for the [framework](releases/framework), [CLI](releases/cli), [Studio](releases/app) and [website](releases/site).
