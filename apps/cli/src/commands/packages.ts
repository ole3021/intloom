import {
  formatInspection,
  schemaSummary,
  loomListText,
} from "../ui/inspection.ts";
import { runNpm } from "@intloom/kernel";

import { inspectLoomPackage, npmRoot, readNpmLoom } from "@intloom/kernel";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { IntloomError } from "@intloom/loom-sdk";
import { installNpmPackage } from "../operations/prepare-npm.ts";
import { installSource } from "../operations/install.ts";
import { allItems } from "../context.ts";
import { ensureService } from "../service/process.ts";
import type { CommandContext } from "../context.ts";
export async function runPackageCommand(ctx: CommandContext) {
  const {
    dataDir,
    mcpPort,
    plain,
    command,
    operation,
    argument,
    output,
    client,
    required,
    select,
    pagination,
    string,
    exact,
  } = ctx;
  if (command === "install") {
    exact(2);
    const npmInstall = await installNpmPackage(
      required(operation, "Specify an npm package or archive."),
      ctx.string("project"),
    );
    if (npmInstall) {
      output(npmInstall);
      return;
    }
    output(
      await installSource(
        ctx,
        required(operation, "Specify an archive or registry package."),
      ),
    );
    return;
  }
  if (command === "init") {
    exact(operation ? 2 : 1);
    const directory = resolve(operation ?? ".");
    await mkdir(directory, { recursive: true });
    const file = join(directory, "intloom.yaml");
    await writeFile(file, "version: 1\n", { flag: "wx" }).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === "EEXIST")
          throw new IntloomError(
            "FILE_EXISTS",
            `${file} already exists. Edit it to configure this project.`,
          );
        throw error;
      },
    );
    output({
      directory,
      file,
      next: "Run a Loom here or in a subdirectory. The Loom selects global or project storage.",
    });
    return;
  }
  if (command === "loom") {
    if (operation === "describe") {
      exact(3);
      if (
        argument &&
        !argument.endsWith(".tgz") &&
        !argument.includes("./") &&
        !argument.startsWith("/")
      ) {
        await ensureService(dataDir, !plain, mcpPort);
        const installed = await client("getLoom", [select(argument)]);
        const m = installed.manifest;
        if (plain) output(installed);
        else if (installed.commands) {
          process.stdout.write(
            `${[
              `${m.name} · ${m.id}@${m.version}`,
              m.description,
              ...Object.entries(installed.commands).map(
                ([name, spec]) =>
                  name +
                  (name === installed.defaultCommand ? " (default)" : "") +
                  " — " +
                  spec.description +
                  "\n  intloom run " +
                  m.id +
                  " " +
                  name +
                  " --input @input.json\n  " +
                  spec.output,
              ),
            ].join("\n")}\n`,
          );
        } else
          process.stdout.write(
            `${m.name} · ${m.id}@${m.version}\n${m.description}\nStorage: ${m.storage ?? "global"}\nInput: ${schemaSummary(m.contracts.input)}\nOutput: ${schemaSummary(m.contracts.output)}\nDelivery: ${m.outcome?.description ?? "See output"}\nRequires: ${JSON.stringify(m.requirements)}\n`,
          );

        return;
      }
      const report = await inspectLoomPackage(
        required(argument, "Specify a Loom archive."),
      );
      if (plain) output(report);
      else process.stdout.write(formatInspection(report));
    } else if (operation === "remove") {
      exact(3);
      const id = required(argument, "Specify the Loom ID.");
      await ensureService(dataDir, !plain, mcpPort);
      const project = ctx.string("project");
      const root = await npmRoot(!project, project);
      const isNpm =
        /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(id) &&
        (await readNpmLoom(join(root, id)));
      if (isNpm)
        await runNpm([
          "uninstall",
          ...(project ? ["--prefix", resolve(project)] : ["--global"]),
          "--",
          id,
        ]);
      const removed = (await client("removeLoom", [id])) || Boolean(isNpm);
      const remaining = await client("listLooms", [{ id }]);
      output({
        id,
        removed,
        remaining: remaining.items,
      });
    } else if (operation === "list") {
      exact(2);
      const id = string("id");
      await ensureService(dataDir, !plain, mcpPort);
      if (!plain && !string("cursor") && !string("limit")) {
        const entries = await allItems((page) =>
          ctx.client("listLooms", [{ ...page, ...(id ? { id } : {}) }]),
        );
        process.stdout.write(`${loomListText(entries, process.stdout)}\n`);
        return;
      }
      output(
        await client("listLooms", [
          {
            ...pagination(),
            ...(id ? { id } : {}),
          },
        ]),
      );
    } else
      throw new IntloomError(
        "INVALID_ARGUMENT",
        "Use loom describe, install, list or remove.",
      );
    return;
  }
}
