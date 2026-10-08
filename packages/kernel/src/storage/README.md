# Storage

File and Drizzle SQLite backends implement StorageAccess directly. The host retains StorageHandle and injects only access into Kernel. See the [Storage architecture](../../../../design/architecture/storage.md) for the complete contract.

```ts
import { openFileStorage } from "@intloom/kernel/storage/file";
import { openSqliteStorage } from "@intloom/kernel/storage/sqlite";

// Choose one backend; a file directory permits only one active handle.
const storage = await openSqliteStorage({
  filename: "/project/intloom/storage.sqlite",
  projectId: "project-123",
});
// const storage = await openFileStorage({ directory: "/project/intloom", layout: "directories" });
try {
  await storage.access.commit([
    { type: "create_artifact", id: "ART-example", payload: { flowName: "example", stageName: "specification", data: {} } },
    { type: "append_record", id: "RUN-example", payload: { flowName: "example", stageName: "specification", data: {} } },
  ]);
} finally {
  await storage.dispose();
}
```

- Each project has one current Artifact per Workflow/Stage. Appended Records can only be deleted.
- commit applies a batch atomically. expectedRevision checks equality; revisions may skip values and are not reused after deletion/recreation.
- Pages default to 50 items with a maximum of 200, ordered by creation time and ID. Cursors bind project, category, and query, without a cross-request snapshot.
- dispose rejects new access and waits for accepted operations before releasing resources. It does not replace awaiting commit or roll back writes started before Runtime cancellation.
- File directories hold store.lock. After abnormal exit, verify that no owner is active before explicit removal. Never reset corrupt or unknown formats to empty.
- SQLite uses better-sqlite3; the synchronous driver may briefly block the event loop. Migrations ship with the package and are validated/applied in a write transaction before access.
- Snapshot, remote databases, and Run recovery are not implemented.

The file subpath also exports inspectFileStorageLock({ directory }) and recoverFileStorageLock({ directory, expected }) for explicit host maintenance, outside StorageAccess. Inspection is read-only. Recovery requires an unchanged lock snapshot and a verifiably absent PID; active or unknown owners block cleanup. Neither operation reads or modifies store.json. The host must coordinate maintenance with startup; CLI recover supplies that coordination. openFileStorage never steals locks automatically.

contracts/types define the public protocol; schemas/query/lifecycle implement shared behavior. file/sqlite own their persistence processes without an extra SQL abstraction. Helpers and shared contract tests live in test/ and are excluded from dist.

## Implementation organization

StorageQuery and StorageCategory are canonical; Query and SnapshotCategory remain deprecated compatibility aliases. File open manages locking and lifecycle; store defines disk format, apply-operations applies batches to a copy, and publish synchronizes temporary files, renames them, and synchronizes the directory. SQLite open manages connections/access, query handles conditions and row conversion, and commit processes the complete batch in one immediate transaction. This separates resource management from commit rules while preserving each backend's atomicity.

## File layouts

`openFileStorage({ directory })` retains the version 1 single `store.json` layout. `layout: "directories"` uses version 2: each Artifact/Record is an immutable content-addressed JSON file under `artifacts/` or `records/`, while `store.json` contains store identity, revision, and the authoritative content references. The whole batch becomes visible only after all content files and directories are synced and the manifest is atomically replaced. Failed publication leaves the previous view; orphan files are ignored. Failure after manifest rename invalidates the open handle until reopening. Missing or corrupt referenced content is an error, never an empty-store reset.

Both layouts lock the same directory with `store.lock`, so they cannot open competing handles. Layout selection does not migrate formats. CLI projects choose directories under `intloom/`. Keep the complete directory for backup; copying only category folders loses commit identity and references. Garbage collection and hand-editing stored JSON are unsupported.

## Diagnostics

Both backends record safe read summaries at debug level and committed IDs/revisions at info level through the current Utils logger. The open-time context is the fallback for calls outside a Run. Failed operations are marked without duplicating raw errors; Runtime/host boundaries own classified failures. A commit event is written only after the backend succeeds; logs are diagnostic evidence, not a transaction journal or replay mechanism.
