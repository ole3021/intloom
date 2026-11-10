# Meeting notes

Turn one meeting transcript or set of rough notes into a Markdown file in the source language. The first section contains up to five bullets you can forward. The full minutes keep decisions, context, commitments and open questions alongside line-numbered quotations. Anonymous notes and meetings that ended without a decision are supported.

## Install and run

Use the [IntLoom 0.4.0 CLI](../../docs/use/first-loom.md) and [configure a model with structured output](../../docs/reference/configuration.md). The configured model receives the meeting text. Download the [meeting-notes 1.0.0 archive](../../apps/site/pages/public/downloads/0.4.0/meeting-notes-1.0.0.tgz) and install it. In an npm project you can add `--project .` for a project-local installation.

```sh
intloom install ./meeting-notes-1.0.0.tgz
intloom run meeting-notes
intloom run meeting-notes summarize --prompt 'We agreed to pilot with 10% of accounts. The launch date is still open. Chen will share regression results by Thursday.'
```

Alternatively, run this from the folder containing your own UTF-8 `notes.md` or `.txt` file. Relative file paths start in the directory where you invoke the CLI. Supply a single source per run.

```sh
intloom run meeting-notes summarize --files ./notes.md
```

Use the run ID from either command to list the delivery. Replace `ARTIFACT_ID` with the ID listed for `meeting-notes.md`.

```sh
intloom artifact list --run RUN_ID
intloom artifact export ARTIFACT_ID --out ./meeting-notes.md
```

## What to expect

| Primary meeting outcome | How to check the minutes | Sample source |
| --- | --- | --- |
| Design review and decision | Find the alternatives, choice or pending decision, rationale and accepted trade-offs. | [Queue design](samples/review.md) |
| Project progress and sync | Find changes, blockers, dependencies and the next checkpoint. | [Payment project](samples/sync.txt) |
| Exploration and brainstorming | Find ideas, hypotheses and proposed experiments, with their uncertainty intact. | [Onboarding discovery](samples/exploration.md) |
| Conclusions and actions (default) | Find confirmed outcomes, commitments and open issues. | [Rollout discussion](samples/action.txt) · [Full sample delivery](samples/action.minutes.md) |

For the rollout sample, check that the first rollout covers 10%, the launch date remains open, and Chen will share regression results by Thursday. In the full version, `L3` points to the third line in the original file. Wording and headings may vary. One meeting may cover several topics. The format follows the main outcome. A task with no explicit owner or deadline retains the details actually supplied. The [mixed-topic sync](samples/mixed.md) includes a supplier proposal that remained open and a separate onboarding update.

## Inputs that stop a run

| Reported code | How to proceed |
| --- | --- |
| `NOT_MEETING_CONTENT` | Supply actual meeting material. Try the [unrelated recipe](samples/unrelated.txt) to reproduce this failure. |
| `AGENDA_WITHOUT_DISCUSSION` or `INSUFFICIENT_MEETING_CONTENT` | Include what happened, such as progress, proposals or questions raised. An [invitation](samples/agenda.txt) alone has no meeting outcomes. |
| `EMPTY_MEETING_SOURCE`, `EXPECTED_TXT_OR_MD` or `EXPECTED_UTF8_TEXT` | Supply nonblank text or a readable UTF-8 text or Markdown file. |
| `UNVERIFIED_SOURCE_QUOTE` or `INCOMPLETE_MEETING_NOTES` | The generated record failed its delivery checks. Check the source and run again. |

A failed run delivers no minutes. Use `intloom status RUN_ID --details` to inspect it. If the CLI reports a missing file, check the supplied path.

## Build the example

The [manifest](loom.yaml) declares the public command and model slot. The [Agent instructions](editor.md) define the four formats and evidence rules. The [Code entry](summarize.ts) reads a source once, calls the Agent, verifies that quotations occur on the cited lines, and writes both versions from one set of statements. The quotations let a reader check the meaning against the source.

If your registry serves the pinned versions in [package.json](package.json), run `npm install` followed by `npm run build` here. For a [matching local candidate](../../docs/maintainers/candidate.md), copy this author directory under the installed candidate and run `npm run build` there. The enclosing installation supplies the compiler and SDK. Install the generated `dist/meeting-notes-1.0.0.tgz` in a separate npm project and run the samples through the CLI. [Author and recipient checks](../../docs/author/distribution.md)
