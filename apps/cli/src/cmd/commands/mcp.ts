import { defineCommand } from "citty";
import type { CmdContext } from "../context.ts";
import { str, bool, invalid, value } from "../arguments.ts";
import { observing } from "../observe.ts";
export function createMcpCommands(context: CmdContext) {
  const { core, io, common, machine, print, leaf } = context;
  return {
    mcp: defineCommand({
      meta: { description: "Project MCP setup and stdio bridge" },
      subCommands: {
        init: leaf(
          "Apply project Codex entry",
          { ide: str("codex"), plan: bool("Preview only") },
          async (a, p) => {
            let ide = value(a, "ide");
            if (!ide && io.isTTY && common.interactive !== false && !machine) {
              const { select, isCancel } = await import("@clack/prompts");
              const chosen = await select({
                message: "Select IDE",
                options: [{ value: "codex", label: "Codex" }],
                input: io.input,
                output: io.error,
              });
              if (isCancel(chosen)) return;
              ide = String(chosen);
            }
            if (ide !== "codex") invalid("Specify --ide codex.");
            const plan = await core.planMcpConfig({ ...p, ide: "codex" });
            if (!plan.ok || a.plan) {
              print(plan);
              return;
            }
            print(
              await core.applyMcpConfig({
                ...p,
                ide: "codex",
                beforeHash: plan.data.beforeHash,
              }),
            );
          },
        ),
        serve: leaf(
          "Full MCP bridge to existing Service",
          { ide: str("Optional codex profile") },
          async (a, p) => {
            const ide = value(a, "ide");
            if (ide && ide !== "codex") invalid("Invalid IDE profile.");
            const { runMcpProxy } = await import("../../mcp/proxy.ts");
            const observer = observing();
            try {
              await runMcpProxy(p.projectPath, io, {
                ...(ide ? { ide: "codex" } : {}),
                signal: observer.controller.signal,
              });
            } finally {
              observer.close();
            }
          },
        ),
      },
    }),
  };
}
