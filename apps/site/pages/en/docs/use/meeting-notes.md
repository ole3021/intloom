# Turn meeting notes into minutes

Give the official meeting-notes Loom a transcript or rough notes. It returns one Markdown file in the meeting’s language. The top contains a few bullets you can forward. The full minutes below them link each point to the original line and quotation.

## Install the package

Install the CLI and configure a model with structured output. After the first npm release, use the package name below in the CLI or in the Studio Loom library. The configured model receives the meeting text.

```sh
intloom install @intloom/meeting-notes
intloom run @intloom/meeting-notes
```

## Paste notes or read a file

```sh
intloom run @intloom/meeting-notes summarize --prompt 'We agreed to pilot with 10% of accounts. The launch date is still open. Chen will share regression results by Thursday.'
```

For this example the brief should preserve the 10% pilot, the open launch date and Chen’s Thursday commitment. No meeting date is given, so Thursday stays relative.

For a longer meeting, save the source as a UTF-8 text or Markdown file. Run from the folder containing it.

```sh
intloom run @intloom/meeting-notes summarize --files ./notes.md
```

Speaker names are optional. Each run takes one source. The main outcome determines the format. A review preserves options and trade-offs, a project sync highlights changes and blockers, and a brainstorming session records hypotheses and experiments. Other meetings use conclusions and actions. An action without a named owner can still be recorded.

## Export the brief and full minutes

Use the run ID printed by the command. Copy the artifact ID for `meeting-notes.md` from the list.

```sh
intloom artifact list --run RUN_ID
intloom artifact export ARTIFACT_ID --out ./meeting-notes.md
```

In the full minutes, a quotation marked `L3` comes from the third line of the supplied source. <a href="https://raw.githubusercontent.com/ole3021/intloom/refs/heads/main/examples/meeting-notes/samples/action.minutes.md">Read a complete sample delivery</a>.

An invitation containing only a future agenda fails with `AGENDA_WITHOUT_DISCUSSION`. Unrelated input, such as a recipe, fails with `NOT_MEETING_CONTENT`. Both end without a file. Supply a record of the discussion and start a new run.
