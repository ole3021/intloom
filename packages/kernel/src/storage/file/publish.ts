import { randomUUID } from "node:crypto";
import { open, rename, rm } from "node:fs/promises";
import { join } from "node:path";

export async function publishStore(
  root: string,
  store: unknown,
  uncertain: (cause: unknown) => void,
): Promise<void> {
  const temporary = join(root, `.store-${randomUUID()}.tmp`);
  let published = false;
  try {
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(JSON.stringify(store));
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporary, join(root, "store.json"));
    published = true;
    const directory = await open(root, "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } catch (cause) {
    // After rename, a failed durability acknowledgement must not permit writes from the old view.
    if (published) uncertain(cause);
    throw cause;
  } finally {
    if (!published) await rm(temporary, { force: true });
  }
}
