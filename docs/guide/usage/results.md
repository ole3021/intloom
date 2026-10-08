---
title: Read and export results
description: Query current Artifacts, read Records, and preserve formal project data.
---

# Read and export results

Workflow Code decides what to commit. A completed Run can produce several outputs, no outputs, or a report containing unresolved findings. Read the package's data and evidence rather than interpreting completion as universal success.

## Find current Artifacts

With the service running:

```sh
intloom artifacts
intloom artifacts --flow your_flow --limit 20
intloom artifact --flow your_flow --stage your_stage
intloom artifact <artifactId> --json
```

An Artifact ID lookup cannot be combined with Workflow/Stage lookup. Location lookup requires both `--flow` and `--stage`. A missing detail query returns `artifact: null`; it does not create an Artifact.

Lists return metadata and an optional `nextCursor`. Keep filters and limit unchanged when using the cursor:

```sh
intloom artifacts --flow your_flow --limit 20 --cursor '<nextCursor>' --json
```

Default page size is 50 and maximum size is 200. Read full business data through the detail command.

## Export a snapshot

```sh
intloom artifact <artifactId> --output ./result.json
```

The destination is relative to the command's working directory, including when `--project` points elsewhere. Its parent must exist. Export includes the complete stored object: ID, Workflow/Stage, revision, timestamps, and business data.

An existing file is rejected unless `--overwrite` is explicit. Exporting a missing Artifact fails without creating a file. The host does not receive the export path; the client writes the returned snapshot locally.

## Read a Record

```sh
intloom record <recordId>
```

Record IDs come from the Workflow's output convention. They need not equal `runId`. Records are immutable entries; current Artifacts can be replaced by later Runs. Revision is a conflict-detection marker, not a historical-version query key.

Queries do not execute Steps or change revisions. They require an active host; start it before querying offline data through the CLI. A failed Run may already have committed Records and Artifacts.

## Preserve data

| Backend | Formal data location |
| --- | --- |
| File | `intloom/`, including the commit manifest and immutable Artifact/Record files |
| SQLite | `intloom/storage.sqlite` and any database sidecar files |

Stop the service before making a consistent file-level backup and preserve the complete formal-data directory. Copying only one Artifact export is not a complete backup. Backend migration and a full backup/restore command are not provided.

`.intloom/` contains credentials, logs, installation content, and recovery checkpoints. Deleting it abandons unfinished recovery and changes connection identity. Do not treat it as disposable.
