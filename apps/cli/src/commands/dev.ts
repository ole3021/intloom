import { z } from "zod";
import { nodeRequirements } from "@intloom/loom-sdk/package-format";
import { observationExitCode } from "./observation-result.ts";
import { statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdtemp,
  readFile,
  rm,
  mkdir,
  readdir,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { IntloomError, defineCode, defineLoom } from "@intloom/loom-sdk";
import { inspectLoomPackage } from "@intloom/kernel";
import { confirm, interactive } from "../ui/prompts.ts";
import { cliName, frameworkVersion } from "../metadata.ts";
import { ensureService } from "../service/process.ts";
import { archiveFilename, buildArchive } from "../operations/build.ts";
import { buildText } from "../ui/build.ts";
import { installSource, npmExec } from "../operations/install.ts";
import { executeLoom } from "../operations/execute.ts";
import type { CommandContext } from "../context.ts";

export async function runDev(ctx: CommandContext) {
  const {
    operation,
    argument,
    exact,
    string,
    required,
    output,
    plain,
    values,
  } = ctx;
  if (operation === "init") {
    const directory = resolve(argument ?? ".");
    exact(argument ? 3 : 2);
    const name = required(string("id") ?? basename(directory), "Specify --id.");
    const display = string("name");
    const version = string("version") ?? "0.1.0";
    // Use the author API as the identity authority, without executing the entry.
    defineLoom({
      id: name,
      ...(display ? { name: display } : {}),
      version,
      description: "A reusable Loom capability",
      entry: defineCode({
        id: "hello",
        inputSchema: z.object({ name: z.string() }),
        outputSchema: z.string(),
        execute: ({ inputData }) => `Hello, ${inputData.name}!`,
      }),
    });
    await mkdir(directory, { recursive: true });
    if ((await readdir(directory)).length)
      throw new IntloomError(
        "FILE_EXISTS",
        "Initialization requires an empty directory.",
      );
    await writeFile(
      join(directory, "package.json"),
      `${JSON.stringify(
        {
          name,
          version,
          private: true,
          type: "module",
          scripts: { build: "intloom-build" },
          devDependencies: {
            "@intloom/compiler": frameworkVersion,
            "@intloom/loom-sdk": frameworkVersion,
            zod: "4.6.7",
          },
          engines: { node: nodeRequirements.node22 },
        },
        null,
        2,
      )}\n`,
      { flag: "wx" },
    );
    await writeFile(
      join(directory, "loom.yaml"),
      `${JSON.stringify(
        {
          name: display ?? name,
          description: "Write a greeting",
          commands: {
            hello: {
              entry: "loom.ts",
              description: "Write a greeting file",
              input: {
                type: "object",
                properties: { name: { type: "string" } },
                required: ["name"],
                additionalProperties: false,
              },
              output: "UTF-8 greeting.txt",
            },
          },
        },
        null,
        2,
      )}\n`,
      { flag: "wx" },
    );
    await writeFile(
      join(directory, "loom.ts"),
      `import {writeFile} from "node:fs/promises";
import {join} from "node:path";
import {defineCode,workDirectory,resultFile,ResultFileSchema} from "@intloom/loom-sdk";
import {z} from "zod";
export default defineCode({id:"hello",inputSchema:z.strictObject({name:z.string()}),outputSchema:ResultFileSchema,
  async execute({inputData,context}) {
    await writeFile(join(workDirectory(context.run),"greeting.txt"),"Hello, "+inputData.name+"!");
    return resultFile("greeting.txt","text/plain");
  }
});
`,
      { flag: "wx" },
    );
    output({
      directory,
      name,
      version,
      next: "Install dependencies with bun install, then bun run build.",
    });
    return;
  }
  if (operation === "build") {
    exact(2);
    const { target, size, elapsedMs, ...archive } = await buildArchive(ctx, {
      directory: string("path"),
      update: Boolean(values.update),
    });
    if (plain) output({ ok: true, ...archive });
    else
      process.stdout.write(
        `${buildText({ ...archive, target, size, elapsedMs }, process.stdout)}\n`,
      );
    return;
  }
  ctx.exact(2);
  if (ctx.operation !== "test" && ctx.operation !== "publish")
    throw new IntloomError(
      "INVALID_ARGUMENT",
      "Use dev init, build, test or publish.",
    );
  if (ctx.values.build) {
    if (ctx.operation !== "test")
      throw new IntloomError(
        "INVALID_ARGUMENT",
        "Only dev test accepts --build.",
      );
    const built = await buildArchive(ctx, {
      directory: ctx.string("path"),
      update: Boolean(ctx.values.update),
    });
    if (!ctx.plain)
      process.stderr.write(`${buildText(built, process.stderr)}\n`);
  }
  const projectDir = resolve(ctx.string("project") ?? ".");
  const pkg = JSON.parse(
    await readFile(join(projectDir, "package.json"), "utf8").catch(() => {
      throw new IntloomError(
        "INVALID_ARGUMENT",
        "Open the Loom project containing package.json first.",
      );
    }),
  );
  if (typeof pkg.name !== "string" || typeof pkg.version !== "string")
    throw new IntloomError(
      "INVALID_ARGUMENT",
      "The author package.json needs a name and version to select its archive.",
    );
  const filename = archiveFilename(pkg.name, pkg.version);
  const archive = resolve(projectDir, ctx.string("path") ?? "dist", filename);
  if (!statSync(archive, { throwIfNoEntry: false })?.isFile())
    throw new IntloomError(
      "FILE_NOT_FOUND",
      `Expected ${archive}. Run ${cliName} dev build first.`,
    );
  if (ctx.operation === "test") {
    const dataDir = ctx.dataDir;
    const testContext = ctx;
    await ensureService(dataDir, !ctx.plain, ctx.mcpPort);
    const ref = await installSource(testContext, archive, {
      snapshotOnly: true,
    });
    if (ref.id !== pkg.name || ref.version !== pkg.version)
      throw new IntloomError(
        "PACKAGE_INCOMPATIBLE",
        "The test archive differs from the project identity.",
      );
    const installed = await testContext.client("getLoom", [ref]);
    process.stderr.write(`Testing ${archive}\nIntloom service: ${dataDir}\n`);
    const observed = await executeLoom(testContext, installed.ref.id, {
      installed,
    });
    if (observed) process.exitCode = observationExitCode(observed);
    return;
  }
  const directory = await mkdtemp(join(tmpdir(), "intloom-publish-"));
  try {
    // Confirm and publish the same bytes even if another build replaces dist in the meantime.
    const file = join(directory, "publish.tgz");
    await copyFile(archive, file);
    const { root } = await inspectLoomPackage(file);
    if (root.id !== pkg.name || root.version !== pkg.version)
      throw new IntloomError(
        "PACKAGE_INCOMPATIBLE",
        "The publication archive differs from the project identity.",
      );
    const config = async (key: string) =>
      (await npmExec("npm", ["config", "get", key])).stdout.trim();
    const scope = root.id.startsWith("@") ? root.id.split("/")[0] : undefined;
    const scoped = scope && (await config(`${scope}:registry`));
    const registry =
      scoped && scoped !== "undefined" && scoped !== "null"
        ? scoped
        : await config("registry");
    const tag = await config("tag");
    const preview = {
      archive,
      package: root.id,
      version: root.version,
      registry,
      tag,
      artifactDigest: root.artifactDigest,
    };
    if (ctx.values["dry-run"]) {
      ctx.output({ ...preview, published: false });
      return;
    }
    if (!interactive())
      throw new IntloomError(
        "CONFIRMATION_REQUIRED",
        "Publication requires confirmation in a terminal. Use --dry-run for a preview.",
      );
    process.stderr.write(
      `Archive  ${archive}\nPackage  ${root.id}@${root.version}\nRegistry ${registry}\nTag      ${tag}\nDigest   ${root.artifactDigest}\n`,
    );
    if (!(await confirm("Publish this archive to the registry above?"))) {
      ctx.output({ ...preview, published: false });
      return;
    }
    const result = spawnSync(
      "npm",
      [
        "publish",
        file,
        "--ignore-scripts",
        "--registry",
        registry,
        "--tag",
        tag,
      ],
      { stdio: "inherit" },
    );
    if (result.status !== 0)
      throw new IntloomError(
        "PUBLISH_FAILED",
        "npm did not confirm publication.",
      );
    ctx.output({ ...preview, published: true });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
