import { z } from "zod";
import { absolutePathSchema } from "../loom/input.ts";

const path = { path: absolutePathSchema };
export const fileInputs = {
  read: z.strictObject(path),
  write: z.strictObject({ ...path, content: z.string() }),
  mkdir: z.strictObject(path),
  stat: z.strictObject({ ...path, followSymlinks: z.boolean().optional() }),
  list: z.strictObject(path),
  remove: z.strictObject({ ...path, recursive: z.boolean().optional() }),
  mkdtemp: z.strictObject({
    directory: absolutePathSchema,
    prefix: z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/)
      .optional(),
  }),
};

export interface FileInfo {
  readonly type: "file" | "directory" | "symlink" | "other";
  readonly size: number;
}
export interface DirectoryEntry {
  readonly name: string;
  readonly type: FileInfo["type"];
}

export interface FileTools {
  read(input: { readonly path: string }): Promise<string>;
  write(input: {
    readonly path: string;
    readonly content: string;
  }): Promise<void>;
  mkdir(input: { readonly path: string }): Promise<void>;
  stat(input: {
    readonly path: string;
    readonly followSymlinks?: boolean;
  }): Promise<FileInfo | null>;
  list(input: { readonly path: string }): Promise<readonly DirectoryEntry[]>;
  remove(input: {
    readonly path: string;
    readonly recursive?: boolean;
  }): Promise<void>;
  mkdtemp(input: {
    readonly directory: string;
    readonly prefix?: string;
  }): Promise<string>;
}

export async function withTempDir<T>(
  context: { readonly fs: FileTools; readonly tempDir: string },
  use: (directory: string) => Promise<T>,
): Promise<T> {
  const path = await context.fs.mkdtemp({ directory: context.tempDir });
  let result: T;
  try {
    result = await use(path);
  } catch (error) {
    // The binding records cleanup failures; preserve the business error.
    await context.fs.remove({ path, recursive: true }).catch(() => {});
    throw error;
  }
  await context.fs.remove({ path, recursive: true });
  return result;
}
