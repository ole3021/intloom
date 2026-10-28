import { mkdir, writeFile, realpath } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { compileLoom } from "./compile-loom.ts";
import { loadCapability } from "./capability/load-capability.ts";
import { fail } from "./errors.ts";
import type { CompileOptions } from "./types.ts";

/** Runs the same static build verification, including TS and package imports, without publishing dist. */
export async function checkLoom(options: CompileOptions) {
  const { outputPath: _, ...result } = await compileLoom({
    ...options,
    checkOnly: true,
  });
  return result;
}

/** Source inspection does not import Code, run models or imply a successful TypeScript build. */
export async function inspectLoom(packageRoot: string) {
  const root = await realpath(resolve(packageRoot));
  const { definition, plan, modules } = await loadCapability(root);
  return {
    definition,
    plan,
    resources: Object.entries(modules).map(([id, item]) => ({
      id,
      kind: item.kind,
      file: item.module.sourceFile,
      exportName: item.module.exportName,
    })),
  };
}

/** Creates a new directory only; existing developer files are never overwritten. */
export async function scaffoldLoom(
  packageRoot: string,
  template: "code" | "agent" = "code",
) {
  const root = resolve(packageRoot),
    name = basename(root);
  if (!/^[a-z][a-z0-9-]*$/.test(name))
    fail(
      "INVALID_LOOM",
      "Use a lowercase hyphenated directory name for the Loom",
    );
  if (template !== "code" && template !== "agent")
    fail("INVALID_LOOM", "Unknown Loom template");
  try {
    await mkdir(root);
  } catch (cause) {
    fail(
      "INVALID_BUILD_CONFIG",
      "The Loom directory must not already exist and its parent must exist",
      { file: root },
      cause,
    );
  }
  const files: Record<string, string> = {
    "loom.yaml": `schemaVersion: "1"\nname: ${name}\nversion: "1.0.0"\ndescription: Transform an input string.\ninput:\n  type: string\n  minLength: 1\noutput:\n  type: string\n${template === "code" ? "execute:\n  code: ./code/run.ts#run\n" : "agents:\n  worker:\n    definition: ./agents/worker.md\n    modelProfile: standard\nexecute:\n  agent: worker\n"}`,
    "README.md": `# ${name}\n\nOne input string produces one output string.\n\nDevelop with \`intloom check .\`, inspect with \`intloom inspect .\`, build with \`intloom build .\`.\nRun installed packages using \`intloom run ${name} --input '"hello"'\`.\n\nloom.yaml owns input/output and execution. Agent Markdown owns instructions. Host model credentials stay outside this package.\n`,
    ".gitignore":
      "dist/\n.intloom-build-*/\n.intloom-build.lock\nnode_modules/\n.env*\n",
    ...(template === "code"
      ? {
          "code/run.ts":
            "export function run(input: string): string {\n  return input.trim();\n}\n",
        }
      : {
          "agents/worker.md":
            "---\nname: worker\ndescription: Transform the supplied text.\n---\n\nPreserve the meaning of the input and return the cleaned text using the declared output contract.\n",
        }),
  };
  for (const [file, content] of Object.entries(files)) {
    if (file.includes("/"))
      await mkdir(dirname(resolve(root, file)), { recursive: true });
    await writeFile(resolve(root, file), content, { flag: "wx" });
  }
  return { packageRoot: root, template, files: Object.keys(files) };
}
