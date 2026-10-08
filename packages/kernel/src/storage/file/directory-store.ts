import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import * as z from "zod";
import { storeSchema, type FileStore } from "./store.ts";
import { publishStore } from "./publish.ts";

const manifestSchema = z.strictObject({
  version: z.literal(2),
  storeId: z.uuid(),
  revision: z.number().int().nonnegative(),
  artifacts: z.array(z.string().regex(/^[a-f0-9]{64}$/)),
  records: z.array(z.string().regex(/^[a-f0-9]{64}$/)),
});
const digest = (text: string) =>
  createHash("sha256").update(text).digest("hex");

export async function readDirectoryStore(
  root: string,
  input: unknown,
): Promise<FileStore> {
  const manifest = manifestSchema.parse(input);
  async function read(category: "artifacts" | "records") {
    return Promise.all(
      manifest[category].map(async (hash) => {
        const text = await readFile(
          join(root, category, `${hash}.json`),
          "utf8",
        );
        if (digest(text) !== hash)
          throw new Error(`Invalid ${category} content hash`);
        return JSON.parse(text);
      }),
    );
  }
  return storeSchema.parse({
    ...manifest,
    version: 1,
    artifacts: await read("artifacts"),
    records: await read("records"),
  });
}

/** Immutable content is durable before one manifest rename makes the complete batch visible. */
export async function publishDirectoryStore(
  root: string,
  store: FileStore,
  uncertain: (cause: unknown) => void,
) {
  async function write(category: "artifacts" | "records") {
    const directory = join(root, category);
    await mkdir(directory, { recursive: true });
    const hashes: string[] = [];
    for (const entry of store[category]) {
      const text = JSON.stringify(entry);
      const hash = digest(text);
      hashes.push(hash);
      const filename = join(directory, `${hash}.json`);
      const existing = await readFile(filename, "utf8").catch(
        (cause: unknown) => {
          if (
            cause instanceof Error &&
            "code" in cause &&
            cause.code === "ENOENT"
          )
            return undefined;
          throw cause;
        },
      );
      if (existing === undefined) {
        const temporary = join(directory, `.${randomUUID()}.tmp`);
        try {
          const file = await open(temporary, "wx", 0o600);
          try {
            await file.writeFile(text);
            await file.sync();
          } finally {
            await file.close();
          }
          await rename(temporary, filename);
        } finally {
          await rm(temporary, { force: true });
        }
      } else if (existing !== text)
        throw new Error("Existing immutable Storage content is corrupt");
    }
    const dir = await open(directory, "r");
    try {
      await dir.sync();
    } finally {
      await dir.close();
    }
    return hashes;
  }
  const artifacts = await write("artifacts");
  const records = await write("records");
  await publishStore(
    root,
    {
      version: 2,
      storeId: store.storeId,
      revision: store.revision,
      artifacts,
      records,
    },
    uncertain,
  );
}
