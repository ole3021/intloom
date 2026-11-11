import { deliveryAnswer, questionAnswer } from "../lifecycle/kernel-wait.ts";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { join, resolve } from "node:path";
import { findProject } from "../project.ts";
import {
  IntloomError,
  type RuntimeBindings,
  type WorkflowDefinition,
  type StepReference,
} from "@intloom/loom-sdk";
import { copyJson, stableJson } from "@intloom/loom-sdk/json";
import { PackageError } from "@intloom/loom-sdk/package-format";
import type { LoomRuntime, RunRecord } from "../lifecycle/run-contracts.ts";
import type { InlineStep } from "./types.ts";
import { selectBindings } from "./bindings.ts";
import type { PackageStore } from "../packages/store.ts";
import { readPackageDirectory } from "../packages/source.ts";
import { effectiveRuntime } from "./versions.ts";
import { runtimeBinding, type createLoomLoader } from "./loader.ts";
export function createRunPreparation(
  packages: PackageStore,
  getBindings: (
    projectDir: string | undefined,
    needsModels: boolean,
  ) => Promise<RuntimeBindings>,
  load: ReturnType<typeof createLoomLoader>,
  globalDir: string,
): Pick<LoomRuntime, "check" | "prepare" | "normalizeResume"> {
  async function check(record: RunRecord) {
    if (record.checkpoint?.engineRef.kind === "delivery") return;
    try {
      const directory = record.binding.config.installedDirectory;
      const artifact = await readPackageDirectory(
        typeof directory === "string"
          ? directory
          : (await packages.getLoom(record.binding.loom)).artifactDir,
      );
      for (const dependency of record.binding.dependencies) {
        const item = await packages.getLoom(dependency);
        const contents = await readPackageDirectory(item.artifactDir);
        if (stableJson(contents.ref) !== stableJson(dependency))
          throw new IntloomError(
            "BINDING_MISMATCH",
            "A locked dependency changed.",
          );
      }
      if (record.binding.config.command) {
        if (artifact.ref.artifactDigest !== record.binding.loom.artifactDigest)
          throw new IntloomError(
            "BINDING_MISMATCH",
            "Original npm installation changed",
          );
        return;
      }
      const selected = selectBindings(
        artifact.manifest,
        await getBindings(
          record.binding.projectDir,
          Boolean(
            record.binding.bindings &&
              Object.keys(record.binding.bindings.models).length,
          ),
        ),
        record.binding.bindings?.models,
      );
      const expected = runtimeBinding(artifact.manifest);
      if (
        stableJson(artifact.ref) !== stableJson(record.binding.loom) ||
        stableJson(expected) !== stableJson(effectiveRuntime(record)) ||
        (record.binding.bindings &&
          stableJson(record.binding.bindings) !==
            stableJson(selected.descriptions))
      )
        throw new IntloomError(
          "BINDING_MISMATCH",
          "The saved package, engine or bindings do not match this runtime.",
        );
    } catch (error) {
      if (error instanceof IntloomError) throw error;
      throw new IntloomError(
        error instanceof PackageError ? error.code : "RECOVERY_UNAVAILABLE",
        "An original Run artifact or dependency is unavailable.",
        { artifactDigest: record.binding.loom.artifactDigest },
      );
    }
  }

  return {
    check,
    async normalizeResume(record, wait, input) {
      const kind = record.checkpoint?.engineRef.kind;
      if (kind === "delivery" || kind === "agent-question") {
        const parsed = (
          kind === "delivery" ? deliveryAnswer : questionAnswer
        ).safeParse(input);
        if (!parsed.success)
          throw new IntloomError(
            "RESPONSE_INVALID",
            "Answer does not satisfy the request.",
          );
        return copyJson(parsed.data, "answer");
      }
      await check(record);
      const value = await load(
        record.binding.loom,
        typeof record.binding.config.installedDirectory === "string"
          ? record.binding.config.installedDirectory
          : undefined,
      );
      let workflow = value.entry as WorkflowDefinition;
      let found: StepReference | undefined;
      for (const [index, id] of wait.definitionPath.entries()) {
        found = workflow.nodes
          .flatMap((node) =>
            "step" in node
              ? [node.step]
              : node.kind === "parallel"
                ? node.steps
                : node.kind === "branch"
                  ? node.branches.map(([, step]) => step)
                  : [],
          )
          .find((step) => step.id === id);
        if (!found)
          throw new IntloomError(
            "CHECKPOINT_INCOMPATIBLE",
            "The original waiting step is unavailable.",
          );
        if (index < wait.definitionPath.length - 1)
          workflow = (found as unknown as { resource: WorkflowDefinition })
            .resource;
      }
      const schema = (found as InlineStep).resumeSchema;
      if (!schema) {
        if (input !== undefined)
          throw new IntloomError(
            wait.view.kind === "interaction"
              ? "RESPONSE_INVALID"
              : "INPUT_INVALID",
            "This wait does not accept resume data.",
          );
        return undefined;
      }
      const parsed = schema.safeParse(input);
      if (!parsed.success)
        throw new IntloomError(
          wait.view.kind === "interaction"
            ? "RESPONSE_INVALID"
            : "INPUT_INVALID",
          "The response does not satisfy the waiting step contract.",
          {
            paths: parsed.error.issues.map((issue) =>
              issue.path.map(String).join("."),
            ),
          },
        );
      return copyJson(parsed.data, "resumeData");
    },
    async prepare(ref, directory) {
      const installed = await packages.getLoom(ref);
      const commandFile = await readFile(
        join(installed.artifactDir, "command.json"),
        "utf8",
      ).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return undefined;
        throw error;
      });
      if (commandFile) {
        const command = JSON.parse(commandFile);
        const inputSchema = z.fromJSONSchema(command.input);
        const projectDir = directory ? resolve(directory) : undefined;
        return {
          binding: {
            formatVersion: 1 as const,
            loom: ref,
            dependencies: [],
            entry: installed.manifest.entry,
            runtime: runtimeBinding(installed.manifest),
            config: {
              command: command.name,
              installedDirectory: installed.artifactDir,
            },
            location: {
              storage: "global" as const,
              dataDir: join(globalDir, ref.id),
              ...(projectDir ? { directory: projectDir, projectDir } : {}),
            },
            ...(projectDir ? { projectDir } : {}),
            outcome: { artifacts: { file: { at: "" } } },
          },
          normalize(input) {
            const validated = inputSchema.safeParse(input);
            if (!validated.success)
              throw new IntloomError(
                "INPUT_INVALID",
                validated.error.issues
                  .map((i) => `${i.path.join(".")}: ${i.message}`)
                  .join(", "),
              );
            return copyJson(validated.data, "input");
          },
        };
      }
      const value = await load(ref);
      const projectDir = directory ? await findProject(directory) : undefined;
      const storage = value.manifest.storage;
      let dataDir: string;
      if (storage === "project") {
        if (!projectDir)
          throw new IntloomError(
            "PROJECT_REQUIRED",
            `Loom ${ref.id} requires project storage. Run intloom init in the project root, then retry from that directory or a subdirectory.`,
          );
        dataDir = join(projectDir, ".intloom");
      } else {
        dataDir = join(globalDir, "looms", ref.id);
      }
      const location = {
        ...(directory ? { directory: resolve(directory) } : {}),
        ...(projectDir ? { projectDir } : {}),
        storage,
        dataDir,
      };
      return {
        binding: {
          ...value.binding,
          location,
          ...(projectDir ? { projectDir } : {}),
          ...(Object.keys(value.manifest.requirements.models).length ||
          value.manifest.requirements.tools.length
            ? {
                bindings: selectBindings(
                  value.manifest,
                  await getBindings(
                    projectDir,
                    Object.keys(value.manifest.requirements.models).length > 0,
                  ),
                ).descriptions,
              }
            : {}),
        },
        normalize(input) {
          const parsed = value.entry.inputSchema.safeParse(input);
          if (!parsed.success)
            throw new IntloomError(
              "INPUT_INVALID",
              "Input does not satisfy the Loom contract.",
              {
                paths: parsed.error.issues.map((issue) =>
                  issue.path.map(String).join("."),
                ),
              },
            );
          try {
            return copyJson(parsed.data, "input");
          } catch {
            throw new IntloomError(
              "INPUT_INVALID",
              "Normalized input must be finite JSON data.",
            );
          }
        },
      };
    },
  };
}
