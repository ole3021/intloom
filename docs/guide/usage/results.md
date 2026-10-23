---
title: Read and export results
---

# Read and export results

Workflow Code decides which formal results to commit. Read current Artifacts and appended Records through the active Service:

```sh
intloom artifacts --loom intent --limit 20 --json
intloom artifact --loom intent --stage specification
intloom artifact ART-example --output ./artifact.json
intloom records --loom intent --limit 20 --json
intloom record REC-example --json
```

Artifact lists contain metadata; detail queries contain business data. Select either an Artifact ID or both Workflow and Stage. The default page size is 50, maximum 200. Reuse `nextCursor` with the same filters and page size.

Export paths are relative to the command's working directory; the parent must exist. Existing output requires explicit `--overwrite`. The exported JSON contains the complete stored snapshot.

## Current versus Run-specific results

A later Run can replace an Artifact. Run result references retain the actual commit's ID and revision. Current details do not become historical data simply because you queried an old Run; TUI reports `historical_revision_unavailable` when the referenced revision is unavailable.

Failed or cancelled Runs can retain successful earlier commits. Completion may produce a report with unresolved findings. See [Intent results](../intent/results.md).

## Preserve formal data

File Storage and SQLite both live under `intloom/`; SQLite uses `intloom/storage.sqlite`. Stop the Service before a consistent file-level backup and copy the complete formal-data directory, including database sidecars. A single exported Artifact is only one snapshot.

`.intloom/` also holds unfinished recovery and connection resources. See [data concepts](../concepts/data.md).
