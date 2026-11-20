import { build } from "./build.ts";
import { check } from "./check.ts";

export async function runAuthoringCommand(
  args: readonly string[],
): Promise<number> {
  const [command, ...flags] = args;
  const directories = flags.filter((flag) => !flag.startsWith("-"));
  const projectDir = directories[0] ?? ".";
  if (
    (command !== "check" && command !== "build") ||
    directories.length > 1 ||
    flags.filter((flag) => flag === "--details").length > 1 ||
    flags.some((flag) => flag.startsWith("-") && flag !== "--details")
  ) {
    console.error(
      "Expected check [directory] [--details] or build [directory] [--details].",
    );
    return 2;
  }
  const result = await (command === "build" ? build : check)({ projectDir });
  if (!result.ok) {
    for (const diagnostic of result.diagnostics) {
      const location = [diagnostic.file, diagnostic.line, diagnostic.column]
        .filter((value) => value !== undefined)
        .join(":");
      const field = diagnostic.path?.length
        ? ` (${diagnostic.path.join(".")})`
        : "";
      console.error(
        `${location ? `${location}: ` : ""}${diagnostic.code}${field}: ${diagnostic.message}`,
      );
    }
    return 1;
  }
  console.log(
    `${command === "build" ? "Built" : "Checked"} ${result.manifest.package.name}@${result.manifest.package.version}${"outputDir" in result ? ` → ${result.outputDir}` : ""}`,
  );
  if (flags.includes("--details")) {
    console.log(`Entry: ${result.manifest.entry.kind}`);
    for (const component of result.inspection.components)
      console.log(
        `  ${component.kind}: ${component.module}#${component.path.join("/")}`,
      );
    console.log(
      `Skills: ${result.manifest.skills.map((skill) => skill.metadata.name).join(", ") || "none"}`,
    );
    console.log(`Resources: ${result.manifest.resources.join(", ") || "none"}`);
    console.log(
      "Code dynamic calls: not statically enumerated; export indirect definitions for inspection.",
    );
  }
  return 0;
}
