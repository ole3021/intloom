import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { startService } from "@intloom/kernel/host";
import type { CoreMeta, CoreResult } from "@intloom/kernel/operations";
import { errorView } from "../../errors.ts";
import { failure } from "../../errors.ts";
import { initProject } from "./init.ts";
import { addLoom } from "../loom-packages.ts";
import { planMcpConfig, applyMcpConfig } from "./mcp-config.ts";
export interface InitInput {
  readonly projectPath: string;
  readonly looms?: readonly string[];
  readonly mcp?: "codex";
  readonly start?: boolean;
}
export interface InitProgress {
  readonly projectRoot: string;
  readonly steps: readonly {
    name: "scaffold" | "looms" | "mcp" | "service";
    status: "completed" | "failed" | "skipped";
    message?: string;
  }[];
}
export async function scaffoldProject(
  input: InitInput,
): Promise<CoreResult<InitProgress>> {
  const meta: CoreMeta = { requestId: randomUUID() };
  const steps: InitProgress["steps"][number][] = [];
  let current: InitProgress["steps"][number]["name"] = "scaffold";
  let applied = false;
  try {
    const result = await initProject(input.projectPath);
    meta.projectRoot = result.projectRoot;
    applied = true;
    steps.push({ name: "scaffold", status: "completed" });
    current = "looms";
    if (new Set(input.looms ?? []).size !== (input.looms?.length ?? 0))
      throw failure(
        "CLI_LOOM_DUPLICATE",
        "Duplicate Loom sources were supplied; the scaffold is retained.",
      );
    for (const source of input.looms ?? [])
      await addLoom(result.projectRoot, source);
    steps.push({
      name: current,
      status: input.looms?.length ? "completed" : "skipped",
    });
    current = "mcp";
    if (input.mcp) {
      const plan = await planMcpConfig({
        projectPath: result.projectRoot,
        ide: input.mcp,
      });
      await applyMcpConfig({
        projectPath: result.projectRoot,
        ide: input.mcp,
        beforeHash: plan.beforeHash,
      });
    }
    steps.push({ name: current, status: input.mcp ? "completed" : "skipped" });
    current = "service";
    if (input.start) {
      const service = await startService({ projectRoot: result.projectRoot });
      meta.serviceInstanceId = service.service.instanceId;
    }
    steps.push({
      name: current,
      status: input.start ? "completed" : "skipped",
    });
    return { ok: true, data: { projectRoot: result.projectRoot, steps }, meta };
  } catch (error) {
    const safe = errorView(error);
    steps.push({ name: current, status: "failed", message: safe.message });
    for (const name of ["scaffold", "looms", "mcp", "service"] as const)
      if (!steps.some((step) => step.name === name))
        steps.push({ name, status: "skipped" });
    return {
      ok: false,
      error: safe,
      outcome: applied ? "applied" : "not_applied",
      data: {
        projectRoot: meta.projectRoot ?? resolve(input.projectPath),
        steps,
      },
      meta,
    };
  }
}
