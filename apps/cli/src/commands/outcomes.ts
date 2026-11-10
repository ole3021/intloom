import { resolve } from "node:path";
import { IntloomError } from "@intloom/loom-sdk";
import type { CommandContext } from "../context.ts";
export async function runOutcomeCommand({
  command,
  operation,
  argument,
  values,
  output,
  client,
  required,
  pagination,
  string,
  count,
  exact,
  plain,
}: CommandContext) {
  const kind = command === "artifact" ? "Artifact" : "Acceptance";
  if (operation === "list") {
    exact(2);
    output(
      await client(`list${kind}s`, [
        {
          runId: required(string("run"), "Specify --run."),
          ...pagination(),
        },
      ]),
    );
  } else if (operation === "get") {
    exact(3);
    output(
      await client(`get${kind}`, [
        required(argument, "Specify the record ID."),
      ]),
    );
  } else if (
    command === "artifact" &&
    (operation === "read" || operation === "export")
  ) {
    exact(3);
    const artifactId = required(argument, "Specify artifactId.");
    const read = async (offset: number, length?: number) =>
      client("readArtifact", [
        { artifactId, offset, ...(length === undefined ? {} : { length }) },
      ]);
    if (operation === "read") {
      let result = await read(count("offset") ?? 0, count("length"));
      if (plain) output(result);
      else {
        while (true) {
          if (!process.stdout.write(Buffer.from(result.data, "base64")))
            await new Promise<void>((resolve) =>
              process.stdout.once("drain", resolve),
            );

          if (
            result.eof ||
            string("offset") !== undefined ||
            string("length") !== undefined
          )
            break;
          result = await read(result.offset + result.length);
        }
      }
    } else {
      const path = resolve(required(string("out"), "Specify --out."));
      output(
        await client("exportArtifact", [
          { artifactId, path, overwrite: Boolean(values.overwrite) },
        ]),
      );
    }
  } else
    throw new IntloomError("INVALID_ARGUMENT", `Unknown ${command} operation.`);
}
