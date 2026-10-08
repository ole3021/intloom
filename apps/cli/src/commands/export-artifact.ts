import { randomUUID } from "node:crypto";
import { link, open, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { StoredArtifact } from "@intloom/kernel";
import { failure } from "../errors.ts";

/** Publishes one query snapshot without overwriting by default; failure leaves no partial target file. */
export async function exportArtifact(
  artifact: StoredArtifact,
  filename: string,
  overwrite = false,
): Promise<void> {
  const temporary = join(
    dirname(filename),
    `.intloom-artifact-${randomUUID()}.tmp`,
  );
  let created = false;
  try {
    const file = await open(temporary, "wx", 0o600);
    created = true;
    try {
      await file.writeFile(`${JSON.stringify(artifact, null, 2)}\n`, "utf8");
      await file.sync();
    } finally {
      await file.close();
    }
    if (overwrite) await rename(temporary, filename);
    else await link(temporary, filename);
  } catch (cause) {
    if (cause instanceof Error && "code" in cause && cause.code === "EEXIST")
      throw failure(
        "CLI_OUTPUT_EXISTS",
        "The target file already exists. Use --overwrite to replace it explicitly.",
        cause,
      );
    throw failure(
      "CLI_ARTIFACT_EXPORT_FAILED",
      "Cannot export the Artifact. Check the target directory and write permissions.",
      cause,
    );
  } finally {
    if (created) await rm(temporary, { force: true }).catch(() => {});
  }
}
