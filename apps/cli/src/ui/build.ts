import type { buildArchive } from "../operations/build.ts";
import { cliName } from "../metadata.ts";
import { paint, wrapText } from "./theme.ts";
export function buildText(
  build: Awaited<ReturnType<typeof buildArchive>>,
  stream: NodeJS.WriteStream,
) {
  return wrapText(
    [
      `${paint(stream, "green", "▰▰▰")} Build complete · ${(build.elapsedMs / 1000).toFixed(2)} s`,
      "",
      `Loom     ${paint(stream, "bold", `${build.root.id}@${build.root.version}`)}`,
      `Archive  ${build.archiveFile}`,
      `Size     ${(build.size / 1024).toFixed(1)} KiB`,
      `Target   ${build.target}`,
      "",
      `Next     ${cliName} dev test`,
    ].join("\n"),
    stream,
  );
}
