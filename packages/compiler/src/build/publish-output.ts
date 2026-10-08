import { rename } from "node:fs/promises";
import { fail } from "../errors.ts";
import { exists } from "./output-files.ts";

/** On restore failure the caller retains the temporary directory containing the previous output. */
export async function publishOutput(
  output: string,
  destination: string,
  backup: string,
  preserveRecovery: () => void,
): Promise<void> {
  const hadPrevious = await exists(destination);
  if (hadPrevious) await rename(destination, backup);
  try {
    await rename(output, destination);
  } catch (cause) {
    if (hadPrevious) {
      try {
        await rename(backup, destination);
      } catch (restoreCause) {
        preserveRecovery();
        fail(
          "BUILD_FAILED",
          `Unable to restore dist; previous output is preserved at ${backup}`,
          undefined,
          new AggregateError([cause, restoreCause]),
        );
      }
    }
    throw cause;
  }
}
