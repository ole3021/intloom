import { stripVTControlCharacters } from "node:util";
import type { JsonValue } from "@intloom/loom-sdk";
import type { ObservationResult } from "../operations/observe.ts";
import type { ServiceClient } from "../service/protocol.ts";
import { cliName } from "../metadata.ts";
import { paint, terminalColors } from "./theme.ts";

function terminalText(text: string) {
  return stripVTControlCharacters(text.replaceAll("\r\n", "\n")).replace(
    /\p{Cc}/gu,
    (char) => (char === "\t" || char === "\n" ? char : ""),
  );
}

export async function printMarkdownDeliveries(
  client: ServiceClient,
  { run, activity }: ObservationResult,
  stream: NodeJS.WriteStream,
) {
  const ids = new Set<string>();
  const deliveries = activity.result.outcome?.deliveries;
  if (deliveries) {
    for (const refs of Object.values(deliveries))
      for (const ref of refs) ids.add(ref.id);
  } else if (run.output !== undefined) {
    function collect(value: JsonValue) {
      if (!value || typeof value !== "object") return;
      if (
        !Array.isArray(value) &&
        value.kind === "artifact" &&
        typeof value.id === "string" &&
        typeof value.runId === "string"
      )
        ids.add(value.id);
      else for (const child of Object.values(value)) collect(child);
    }
    collect(run.output);
  }

  for (const id of ids) {
    try {
      const file =
        activity.artifacts.find((f) => f.id === id) ??
        (await client("getArtifact", [id]));
      const mime = file.mediaType.split(";", 1)[0]?.trim().toLowerCase();
      if (
        mime !== "text/markdown" &&
        mime !== "text/x-markdown" &&
        !(
          (mime === "text/plain" || mime === "application/octet-stream") &&
          /\.(md|markdown)$/i.test(file.name)
        )
      )
        continue;

      const { data, eof } = await client("readArtifact", [
        { artifactId: id, length: 64 * 1024 },
      ]);
      const markdown = new TextDecoder("utf-8", { fatal: true }).decode(
        Buffer.from(data, "base64"),
        { stream: !eof },
      );
      const { render } = await import("markdansi");
      const content = render(terminalText(markdown), {
        width: stream.columns || 80,
        color: terminalColors(stream),
        hyperlinks: false,
      });
      const name = terminalText(file.name).replace(/[\t\n]/g, " ");
      stream.write(
        `\n${paint(stream, "bold", name)}\n\n${content.trimEnd()}\n`,
      );
      if (!eof)
        stream.write(
          `… Preview truncated. Export the complete file: ${cliName} artifact export ${id} --out <path>\n`,
        );
    } catch {
      stream.write(
        `Preview unavailable · ${cliName} artifact export ${id} --out <path>\n`,
      );
    }
  }
}
