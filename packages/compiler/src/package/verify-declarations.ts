import { lstat, readFile } from "node:fs/promises";
import { isBuiltin } from "node:module";
import { dirname, resolve } from "node:path";
import { fail } from "../errors.ts";
import { isPathWithin } from "../source/references.ts";
import { declarationReferences } from "./declaration-references.ts";

export async function verifyDeclarations(
  file: string,
  output: string,
  dependencies: Readonly<Record<string, string>>,
): Promise<void> {
  for (const ref of declarationReferences(await readFile(file, "utf8"))) {
    if (ref.kind === "path" || ref.specifier.startsWith(".")) {
      const target = resolve(dirname(file), ref.specifier);
      if (!isPathWithin(output, target))
        fail(
          "INVALID_OUTPUT",
          `Declaration reference escapes output: ${ref.specifier}`,
          { file },
        );
      const declaration =
        ref.kind === "path"
          ? target
          : /\.[jt]s$/.test(target) && !target.endsWith(".d.ts")
            ? `${target.slice(0, -3)}.d.ts`
            : /\.[mc][jt]s$/.test(target) && !/\.d\.[mc]ts$/.test(target)
              ? target.replace(
                  /\.[mc][jt]s$/,
                  target.endsWith(".mjs") || target.endsWith(".mts")
                    ? ".d.mts"
                    : ".d.cts",
                )
              : target;
      const found = await lstat(declaration).then(
        (s) => s.isFile(),
        () => false,
      );
      if (!found)
        fail(
          "INVALID_OUTPUT",
          `Missing emitted declaration: ${ref.specifier}`,
          { file },
        );
    } else if (!isBuiltin(ref.specifier) || ref.kind === "types") {
      const name = ref.specifier.startsWith("@")
        ? ref.specifier.split("/").slice(0, 2).join("/")
        : (ref.specifier.split("/")[0] ?? "");
      const typesName = `@types/${name.startsWith("@") ? name.slice(1).replace("/", "__") : name}`;
      if (
        !Object.hasOwn(dependencies, name) &&
        !Object.hasOwn(dependencies, typesName)
      )
        fail(
          "INVALID_OUTPUT",
          `Declaration dependency is not declared: ${ref.specifier}`,
          { file },
        );
    }
  }
}
