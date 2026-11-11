# Hello Loom

Run a three-step Workflow that asks what to call you, checks nearby weather and delivers a greeting card. The card explains what happened and includes a working meeting-notes example. Hello Loom needs no model account or API key.

## Install and run

Install the IntLoom CLI with `npm install --global intloom`. From the folder containing the built archive, run

```sh
intloom install ./intloom-hello-loom-1.0.0.tgz
intloom run @intloom/hello-loom hello
```

Answer the question with a name or nickname. The question belongs to the Run, so you can leave and answer it later. In Studio, choose the installed **Hello Loom** in the Loom library, launch **hello**, answer the question and open **hello.md** in the completed Run. The terminal records the card in the Run log and gives the export command for its artifact.

```sh
intloom artifact list --run RUN_ID
intloom artifact export ARTIFACT_ID --out ./hello.md
```

The first question sets the card language from the Kernel process's system locale. The package includes Simplified and Traditional Chinese, English, Japanese, Korean, Spanish, French, German, Portuguese and Arabic. Other locales use English. The Run keeps the chosen language when it resumes.

## How the Workflow works

| Step | What it does |
| --- | --- |
| `ask-name` | Suspends with a localized question. A valid answer resumes the same Run. |
| `local-weather` | Makes one HTTPS request to wttr.in for nearby weather. Only the connection's public network location is used. A VPN or a remote Kernel can change the reported area. Your name stays with the Run. |
| `write-greeting` | Writes the greeting and available weather to the activity log and delivers the same card as a UTF-8 Markdown file. If the service is unavailable after five seconds, the card still includes the greeting, available system time zone and tutorial. |

The [Workflow entry](hello.ts) connects the steps. The [weather reader](weather.ts) interprets the service response, and the [translations](messages.ts) provide the words for each language. The card links to the [meeting-notes tutorial](https://intloom.ai/docs/use/meeting-notes). Running that separate Loom requires a configured model with structured output.

## Build from this repository

With workspace dependencies and the Compiler built, run

```sh
bun run --cwd examples/hello-loom build
```

Install the archive from `examples/hello-loom/dist/` using the commands above.
