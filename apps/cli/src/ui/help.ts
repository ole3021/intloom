import { heading, paint, wrapText } from "./theme.ts";
import { cliName, version } from "../metadata.ts";
import { isPlainOutput } from "./output-mode.ts";

import { commandSpecs, commandSpec } from "../command-spec.ts";

export function helpText(
  path: string[] = [],
  stream: NodeJS.WriteStream = process.stdout,
  plain = false,
) {
  const style = (format: "bold" | "dim" | "green", text: string) =>
    plain ? text : paint(stream, format, text);
  const lines = [plain ? `Intloom ${version}` : heading(stream), ""];
  const query = path.join(" ");
  const matches = commandSpecs.filter(
    ([name]) => name === query || name.startsWith(`${query} `),
  );
  if (query && matches.length) {
    const grouped = matches.length > 1;
    for (const [name, syntax, description, options] of matches) {
      if (grouped && name !== query) continue;
      lines.push(
        style("bold", `${cliName} ${name}${syntax ? ` ${syntax}` : ""}`),
        `  ${description}`,
        ...(options.length
          ? [`  Options: ${options.map((name) => `--${name}`).join(" · ")}`]
          : []),
        "",
      );
      if (options.some((name) => name === "details"))
        lines.push(
          "  --details  Show full paths, output and original diagnostics.",
          "",
        );
    }
    if (grouped) {
      lines.push(style("bold", "Subcommands"));
      for (const [name, syntax] of matches.filter(([name]) => name !== query)) {
        const argument = syntax.startsWith("<") ? syntax.split(" ")[0] : "";
        lines.push(`  ${name}${argument ? ` ${argument}` : ""}`);
      }
      lines.push("", `Details  ${cliName} ${query} <subcommand> --help`, "");
    }
    if (path[0] === "run" || (path[0] === "dev" && path[1] === "test"))
      lines.push(
        "Input  JSON, @file or @- (stdin); the terminal prompts for missing fields.",
        "",
      );
  } else {
    lines.push(
      `Usage  ${cliName} <command> [options]`,
      "",
      style("bold", "Quick start"),
      `  ${style("green", `${cliName} run <loom>`)}`,
      `  ${cliName} status --watch`,
      "",
    );
    const groups: [string, [string, string][]][] = [
      [
        "Everyday commands",
        commandSpecs
          .filter(
            ([name]) =>
              ["run", "status", "install", "init"].includes(name) ||
              name.startsWith("loom "),
          )
          .map(([name, syntax, description]) => [
            name +
              (syntax.startsWith("<") || syntax.startsWith("[")
                ? ` ${syntax.split(" ")[0]}`
                : ""),
            description,
          ]),
      ],
      [
        "Development",
        commandSpecs
          .filter(([, , , , handler]) => handler === "dev")
          .map(([name, , description]) => [name, description]),
      ],
      [
        "Services",
        commandSpecs
          .filter(([, , , , handler]) => handler === "service")
          .map(([name, , description]) => [name, description]),
      ],
    ];
    for (const [label, rows] of groups) {
      lines.push(style("bold", label));
      for (const [name, description] of rows)
        lines.push(
          !isPlainOutput() && (stream.columns || 80) < 65
            ? `  ${name}\n    ${style("dim", description)}`
            : `  ${name.padEnd(24)}${style("dim", description)}`,
        );
      lines.push("");
    }
    lines.push(
      style("bold", "More help"),
      `  ${cliName} <command> --help`,
      "  run · interaction · artifact · acceptance",
      "",
    );
  }
  lines.push(
    style("bold", "Common options"),
    "  --help            Show help for the current command",
    "  --plain           Noninteractive output; results to stdout, logs to stderr",
    ...(!query || commandSpec(path)?.[3].some((name) => name === "project")
      ? ["  --project PATH    Invocation directory for project discovery"]
      : []),
  );
  if (!query)
    lines.push(
      style(
        "dim",
        `  Run ${cliName} without arguments for the menu; --version shows the version.`,
      ),
    );
  return `${wrapText(lines.join("\n"), stream)}\n`;
}
