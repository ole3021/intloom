import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { failure } from "../errors.ts";
import type { CliIo } from "./context.ts";
import { invalid, value, type Values } from "./arguments.ts";
export function createTextInput(io: CliIo) {
  async function text(
    a: Values,
    name: string,
    fileFlag: string,
  ): Promise<string> {
    if (a[name] !== undefined && a[fileFlag] !== undefined)
      invalid(`Use either --${name} or --${fileFlag}.`);
    const file = value(a, fileFlag);
    if (!file) return value(a, name, true);
    if (file === "-") {
      const chunks: Buffer[] = [];
      for await (const chunk of io.input) chunks.push(Buffer.from(chunk));
      return Buffer.concat(chunks).toString("utf8");
    }
    try {
      return await readFile(resolve(io.cwd, file), "utf8");
    } catch {
      throw failure(
        "CLI_INPUT_FILE_INVALID",
        "Cannot read the specified input file.",
      );
    }
  }
  return text;
}
