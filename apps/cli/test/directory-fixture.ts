import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";

export async function temporaryDirectory(
  t: TestContext,
  beforeRemove?: (directory: string) => Promise<void>,
) {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), "intloom-cli-init-")),
  );
  t.after(async () => {
    await beforeRemove?.(directory);
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}
