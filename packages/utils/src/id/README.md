# ID generation

Generate prefixed random IDs or timestamped Run IDs. See the [Utils overview](../../README.md) for installation; import both functions from `@intloom/utils`.

## Usage

```ts
import { generateId, generateRunId } from "@intloom/utils";

const codeId = generateId("CODE"); // CODE-<21 random characters>
const agentId = generateId("AGENT"); // AGENT-<21 random characters>
const shortId = generateId("ITEM", 12); // ITEM-<12 random characters>
const runId = generateRunId(new Date("2026-10-08T06:30:15.123Z"));
// RUN-20261008T063015123Z-<21 random characters>
```

## API

| API | Result |
| --- | --- |
| `generateId(prefix, size = 21)` | `${prefix}-<random suffix>`; return type preserves the literal prefix as `` `${Prefix}-${string}` `` |
| `generateRunId(date = new Date())` | `RUN-<UTC timestamp>-<21 random characters>`; returns `` `RUN-${string}` `` |

`size` counts only the random suffix, excluding the prefix and separator. Prefix case is preserved. Nanoid supplies its default URL-safe alphabet: letters, digits, `_`, and `-`.

Run timestamps include UTC milliseconds in `YYYYMMDDTHHmmssSSSZ` format. A supplied `Date` controls the timestamp; the random suffix is generated on every call, including calls with the same timestamp.

## Validation and uniqueness

`generateId` requires a nonempty string prefix without whitespace and a positive safe-integer size. Invalid arguments throw `LoomError` with `INVALID_ID_PREFIX` or `INVALID_ID_SIZE`. `generateRunId` uses `Date.toISOString()`; an invalid `Date` throws `RangeError`.

Neither function stores a registry or guarantees collision-free IDs. Consumers enforce uniqueness where needed. IntLoom Compiler checks resource IDs within one compilation; Runtime uses timestamped IDs for Runs. Log filenames have a separate lifecycle described in the [Logger documentation](../logger/README.md).
