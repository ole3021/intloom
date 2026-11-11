# Meeting notes

Turn one meeting transcript or set of rough notes into a Markdown file in the source language. The first section contains up to five bullets you can forward. The full minutes keep decisions, context, commitments and open questions alongside line-numbered quotations. Anonymous notes and meetings that ended without a decision are supported.

## Install and run

Install the IntLoom CLI and the meeting-notes package from npm. In Studio, enter `@intloom/meeting-notes` in the Loom library.

```sh
npm install --global intloom
intloom install @intloom/meeting-notes
intloom run @intloom/meeting-notes
```

[Configure a model with structured output](https://github.com/ole3021/intloom/blob/main/docs/reference/configuration.md) before running `summarize`. The configured model receives the meeting text.

```sh
intloom run @intloom/meeting-notes summarize --prompt 'We agreed to pilot with 10% of accounts. The launch date is still open. Chen will share regression results by Thursday.'
```

Alternatively, run this from the folder containing your own UTF-8 `notes.md` or `.txt` file. Relative file paths start in the directory where you invoke the CLI. Supply a single source per run.

```sh
intloom run @intloom/meeting-notes summarize --files ./notes.md
```

Use the run ID from either command to list the delivery. Replace `ARTIFACT_ID` with the ID listed for `meeting-notes.md`.

```sh
intloom artifact list --run RUN_ID
intloom artifact export ARTIFACT_ID --out ./meeting-notes.md
```

## What to expect

| Primary meeting outcome | How to check the minutes | Sample source |
| --- | --- | --- |
| Design review and decision | Find the alternatives, choice or pending decision, rationale and accepted trade-offs. | [Queue design](https://github.com/ole3021/intloom/blob/main/examples/meeting-notes/samples/review.md) |
| Project progress and sync | Find changes, blockers, dependencies and the next checkpoint. | [Payment project](https://github.com/ole3021/intloom/blob/main/examples/meeting-notes/samples/sync.txt) |
| Exploration and brainstorming | Find ideas, hypotheses and proposed experiments, with their uncertainty intact. | [Onboarding discovery](https://github.com/ole3021/intloom/blob/main/examples/meeting-notes/samples/exploration.md) |
| Conclusions and actions (default) | Find confirmed outcomes, commitments and open issues. | [Rollout discussion](https://github.com/ole3021/intloom/blob/main/examples/meeting-notes/samples/action.txt) · [Full sample delivery](https://github.com/ole3021/intloom/blob/main/examples/meeting-notes/samples/action.minutes.md) |

For the rollout sample, check that the first rollout covers 10%, the launch date remains open, and Chen will share regression results by Thursday. In the full version, `L3` points to the third line in the original file. Wording and headings may vary. One meeting may cover several topics. The format follows the main outcome. A task with no explicit owner or deadline retains the details actually supplied. The [mixed-topic sync](https://github.com/ole3021/intloom/blob/main/examples/meeting-notes/samples/mixed.md) includes a supplier proposal that remained open and a separate onboarding update.

The [extended rollout discussion](https://github.com/ole3021/intloom/blob/main/examples/meeting-notes/samples/rollout-review.txt) leaves the launch date, second rollout size and use of automatic rollback open. It explicitly rules out skipping payment regression and approves a rollback rehearsal.

## Inputs that stop a run

| Reported code | How to proceed |
| --- | --- |
| `NOT_MEETING_CONTENT` | Supply actual meeting material. Try the [unrelated recipe](https://github.com/ole3021/intloom/blob/main/examples/meeting-notes/samples/unrelated.txt) to reproduce this failure. |
| `AGENDA_WITHOUT_DISCUSSION` or `INSUFFICIENT_MEETING_CONTENT` | Include what happened, such as progress, proposals or questions raised. An [invitation](https://github.com/ole3021/intloom/blob/main/examples/meeting-notes/samples/agenda.txt) alone has no meeting outcomes. |
| `EMPTY_MEETING_SOURCE`, `EXPECTED_TXT_OR_MD` or `EXPECTED_UTF8_TEXT` | Supply nonblank text or a readable UTF-8 text or Markdown file. |
| `UNVERIFIED_SOURCE_QUOTE` or `INCOMPLETE_MEETING_NOTES` | The generated record failed its delivery checks. Check the source and run again. |

A failed run delivers no minutes. Use `intloom status RUN_ID` to inspect the failure, or `intloom status RUN_ID --plain` for JSON output. If the CLI reports a missing file, check the supplied path.

## Build from source

In the IntLoom repository, install the workspace dependencies and build the Compiler. Run `bun run --cwd examples/meeting-notes build` to prepare the public npm directory at `examples/meeting-notes/dist/npm`. See the [maintainer release instructions](https://github.com/ole3021/intloom/blob/main/docs/maintainers/development.md#meeting-notes-npm-package).
