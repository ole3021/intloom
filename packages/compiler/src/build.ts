import { join, resolve } from "node:path";
import { writeOutput } from "./output/write.ts";
import { type CompilerOptions, prepare } from "./prepare.ts";

export async function build(options: CompilerOptions = {}) {
  const outputDir = resolve(options.projectDir ?? ".", "dist");
  const result = await prepare(options, (stage, scratch, manifest) =>
    writeOutput(
      stage,
      outputDir,
      join(scratch, "previous"),
      manifest.package.name,
    ),
  );
  return result.ok ? { ...result, outputDir } : result;
}
