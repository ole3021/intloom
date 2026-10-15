import type { LoomView } from "@intloom/kernel";
import type { ServiceStatus } from "@intloom/kernel/service";
import type { OperationReceipt } from "@intloom/kernel/service/api-contracts";
import type { CoreResult, ServiceRunView } from "../core/index.ts";
import { renderRun, renderStatus, renderLooms } from "../ui/render.ts";
import { formatLog } from "../ui/logs.ts";

interface RenderOptions {
  readonly command?: string;
  readonly debug?: boolean;
  readonly exportedTo?: string;
}
type Fields = Record<string, unknown>;
const object = (value: unknown): Fields | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Fields)
    : undefined;
const objects = (value: unknown): Fields[] =>
  Array.isArray(value)
    ? value.map(object).filter((item) => item !== undefined)
    : [];
// Direct terminal text must not interpret control characters from project data.
const clean = (value: string) =>
  value.replace(/[^\S\n]|\p{Cc}/gu, (char) =>
    char === "\n" || char === " " ? char : " ",
  );
const scalar = (value: unknown): string =>
  value === undefined
    ? "unknown"
    : value === null
      ? "none"
      : typeof value === "boolean"
        ? value
          ? "yes"
          : "no"
        : clean(String(value));
const line = (name: string, value: unknown) => `${name}: ${scalar(value)}`;
const section = (title: string, body: string) => `${title}\n${body}`;

/** Preserve arbitrary config/Artifact/Record data as indented text, never a JSON dump. */
export function formatDetails(value: unknown, indent = ""): string {
  if (Array.isArray(value)) {
    if (!value.length) return `${indent}(empty)`;
    return value
      .map((item) => {
        const text = formatDetails(item, `${indent}  `);
        return `${indent}- ${text.slice(indent.length + 2)}`;
      })
      .join("\n");
  }
  const fields = object(value);
  if (fields) {
    const entries = Object.entries(fields).filter(
      ([, item]) => item !== undefined,
    );
    if (!entries.length) return `${indent}(empty)`;
    return entries
      .map(([key, item]) =>
        object(item) ||
        Array.isArray(item) ||
        (typeof item === "string" && item.includes("\n"))
          ? `${indent}${clean(key)}:\n${formatDetails(item, `${indent}  `)}`
          : `${indent}${clean(key)}: ${scalar(item) || "(empty)"}`,
      )
      .join("\n");
  }
  return (scalar(value) || "(empty)")
    .split("\n")
    .map((part) => indent + part)
    .join("\n");
}
function table(headers: string[], rows: unknown[][]): string {
  const cells = [headers, ...rows].map((row) =>
    row.map((cell) => scalar(cell).replaceAll("\n", " ")),
  );
  const widths = headers.map((_, column) =>
    Math.max(...cells.map((row) => row[column]?.length ?? 0)),
  );
  return cells
    .map((row) =>
      row
        .map((cell, column) =>
          column === headers.length - 1
            ? cell
            : cell.padEnd(widths[column] ?? 0),
        )
        .join("  "),
    )
    .join("\n");
}
function duration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60000)} min ${Math.floor((ms % 60000) / 1000)} s`;
}
export function formatRun(run: ServiceRunView) {
  const metric = run.metrics;
  return [
    renderRun(run),
    `Instance: ${run.serviceInstanceId} · revision ${run.revision} · settled ${run.settled ?? false}`,
    ...(metric
      ? [
          `Execution: ${duration(metric.timing.executionMs)} · human wait ${duration(metric.timing.humanWaitMs)}`,
          `Calls: agents ${metric.calls.agents} · models ${metric.calls.modelRequests} · tools ${metric.calls.tools}`,
          `Tokens: input ${metric.usage.inputTokens ?? "unknown"} · output ${metric.usage.outputTokens ?? "unknown"} (${metric.usage.completeness})`,
          `Estimated cost: ${metric.cost.knownAmount === undefined ? "unknown" : `${metric.cost.knownAmount} ${metric.cost.currency}`} (${metric.cost.completeness})`,
        ]
      : []),
    ...(run.results?.length
      ? [
          "Committed results:",
          ...run.results.map(
            (item) =>
              `  ${item.kind}: ${item.id}${item.revision ? ` · revision ${item.revision}` : ""} · ${item.stageName}/${item.stepName}`,
          ),
        ]
      : []),
  ].join("\n");
}
function runDetails(run: ServiceRunView) {
  return [
    formatRun(run),
    ...(run.pendingAction
      ? [
          "",
          section("Pending action", formatDetails(run.pendingAction.request)),
          `Next: intloom answer ${run.runId} --action ${run.pendingAction.id} --answer-file <file>`,
        ]
      : []),
  ].join("\n");
}
function looms(data: unknown): string {
  const views = objects(data);
  if (!views.length) return "No Looms loaded.\nNext: intloom loom list";
  return [
    `Looms (${views.length})`,
    table(
      ["LOOM", "READINESS", "PACKAGE"],
      views.map((view) => [
        view.loomName ?? "—",
        view.isAvailable
          ? (object(view.readiness)?.status ?? "available")
          : "unavailable",
        view.packageName,
      ]),
    ),
    ...views.flatMap((view) => {
      const error = object(view.error) ?? object(object(view.readiness)?.error);
      return error
        ? [
            `\n${scalar(view.loomName ?? view.packageName)}: ${scalar(error.code)} — ${scalar(error.message)}`,
          ]
        : [];
    }),
  ].join("\n");
}
function runs(data: unknown): string {
  const views = objects(data);
  return views.length
    ? section(
        `Runs (${views.length})`,
        table(
          ["RUN", "LOOM", "STATUS", "STAGE / STEP"],
          views.map((run) => [
            run.runId,
            run.loomName,
            run.status,
            `${scalar(object(run.cursor)?.stageName)} / ${scalar(object(run.cursor)?.stepName)}`,
          ]),
        ),
      )
    : "No Runs in this Service instance.";
}
function receipt(value: OperationReceipt): string {
  return [
    `Request ${value.status}`,
    line("Operation", value.operationId),
    line("Instance", value.serviceInstanceId),
    ...(value.status === "accepted" ? [line("Run", value.runId)] : []),
    ...(value.status === "rejected"
      ? [`${value.error.code}: ${value.error.message}`]
      : []),
    ...(value.status === "pending"
      ? [
          `Next: intloom operation ${value.operationId} --instance ${value.serviceInstanceId}`,
        ]
      : []),
  ].join("\n");
}
function page(data: Fields, command: string): string {
  const artifacts = command === "artifacts";
  const items = objects(data.data),
    title = artifacts ? "Artifacts" : "Records";
  return [
    items.length
      ? section(
          `${title} (${items.length})`,
          table(
            artifacts
              ? ["ARTIFACT", "LOOM", "STAGE", "REVISION"]
              : ["RECORD", "LOOM", "STAGE", "CREATED"],
            items.map((item) => [
              item.id,
              item.loomName,
              item.stageName,
              artifacts ? item.revision : item.createdAt,
            ]),
          ),
        )
      : `No ${title.toLowerCase()} found.`,
    ...(data.nextCursor
      ? [
          line("Next cursor", data.nextCursor),
          `Next: intloom ${command} --cursor '${scalar(data.nextCursor).replaceAll("'", "'\\''")}' (keep the same filters)`,
        ]
      : []),
    ...(items.length
      ? [`Inspect: intloom ${artifacts ? "artifact" : "record"} <ID>`]
      : []),
  ].join("\n");
}
function formatData(value: unknown, options: RenderOptions): string {
  const command = options.command ?? "",
    data = object(value);
  if (command === "logs") {
    const records = Array.isArray(value) ? objects(value) : data ? [data] : [];
    return records.length
      ? records
          .map((record) => formatLog(record, options.debug, true).trimEnd())
          .join("\n")
      : "No matching logs.";
  }
  if (command === "looms") return looms(value);
  if (command === "runs") return runs(value);
  if (!data) return value === null ? "Not found." : formatDetails(value);
  if (command === "build")
    return [
      `Built ${scalar(data.packageName)}@${scalar(data.packageVersion)}`,
      line("Loom", data.loomName),
      line("Source", data.packageRoot),
      line("Output", data.outputPath),
      ...objects(data.diagnostics).map((diagnostic) => {
        const at = object(diagnostic.location);
        const location = at
          ? `${scalar(at.file)}${at.line ? `:${scalar(at.line)}:${scalar(at.column ?? 1)}` : ""}: `
          : "";
        return `Warning ${scalar(diagnostic.code)}: ${location}${scalar(diagnostic.message)}`;
      }),
    ].join("\n");
  if (data.type === "project_snapshot")
    return [
      renderStatus(data.service as ServiceStatus),
      "",
      looms(data.looms),
      "",
      runs(data.runs),
    ].join("\n");
  if (data.type === "service_snapshot")
    return renderStatus(data.service as ServiceStatus);
  if (data.type === "service_closing")
    return `Service closing\n${line("Instance", data.serviceInstanceId)}`;
  if (data.receipt)
    return [
      receipt(data.receipt as OperationReceipt),
      ...(data.run ? ["", runDetails(data.run as ServiceRunView)] : []),
    ].join("\n");
  if (command === "operation") return receipt(value as OperationReceipt);
  if (data.run)
    return [
      ...(data.reason ? [line("Observation", data.reason), ""] : []),
      runDetails(data.run as ServiceRunView),
    ].join("\n");
  if (data.runId && data.status) return runDetails(value as ServiceRunView);
  if (command === "status")
    return data.service
      ? renderStatus(data.service as ServiceStatus)
      : [
          `Service ${scalar(data.status)}`,
          line("Project", data.projectRoot),
          ...(data.diagnostic
            ? [formatDetails(data.diagnostic)]
            : ["Next: intloom start"]),
        ].join("\n");
  if (command === "start") {
    const service = object(data.service) ?? {};
    return [
      `Service ${data.reused ? "already running" : "started"}`,
      line("Project", service.projectRoot),
      line("Address", service.url),
      line("PID", service.pid),
      line("Storage", service.storage),
      line("Instance", service.instanceId),
      "Next: intloom looms",
    ].join("\n");
  }
  if (command === "stop")
    return [
      `Service ${data.stopped ? "stopped" : "already stopped"}`,
      line("Project", data.projectRoot),
    ].join("\n");
  if (command === "init")
    return [
      "Project setup",
      line("Project", data.projectRoot),
      "",
      ...objects(data.steps).map(
        (step) =>
          `  ${scalar(step.status).padEnd(9)} ${scalar(step.name)}${step.message ? ` — ${scalar(step.message)}` : ""}`,
      ),
    ].join("\n");
  if (command === "doctor")
    return [
      "Project checks",
      line("Project", data.projectRoot),
      line("Service", data.status),
      line("Execution", data.source),
      ...(data.message ? [scalar(data.message)] : []),
      "",
      ...objects(data.checks).map(
        (check) =>
          `  ${scalar(check.status).padEnd(11)} ${scalar(check.name)}\n    ${scalar(check.message)}${check.nextStep ? `\n    Next: ${scalar(check.nextStep)}` : ""}`,
      ),
      ...(objects(data.owners).length
        ? [
            "",
            section(
              "Resource owners",
              table(
                ["RESOURCE", "PID", "STATUS"],
                objects(data.owners).map((owner) => [
                  owner.resource,
                  owner.pid,
                  owner.status,
                ]),
              ),
            ),
          ]
        : []),
      ...(data.looms ? ["", renderLooms(data.looms as LoomView[])] : []),
    ].join("\n");
  if (command === "recover")
    return [
      data.dryRun
        ? "Recovery preview"
        : data.recovered
          ? "Recovery completed"
          : "No recovery needed",
      line("Project", data.projectRoot),
      section(
        data.dryRun ? "Eligible paths" : "Removed paths",
        formatDetails(data.paths),
      ),
    ].join("\n");
  if (command.startsWith("loom ")) {
    const items = objects(data.looms);
    return [
      command === "loom add"
        ? "Loom package added"
        : command === "loom remove"
          ? "Loom package removed"
          : "Loom packages",
      line("Project", data.projectRoot),
      line("Installation", data.installation),
      "",
      items.length
        ? table(
            ["PACKAGE", "VERSION"],
            items.map((item) => [item.name, item.version]),
          )
        : "No Loom packages declared.",
    ].join("\n");
  }
  if (command === "config show")
    return [
      "Project configuration",
      line("Project", data.projectRoot),
      line("Revision", data.revision),
      "",
      formatDetails(data.configuration),
    ].join("\n");
  if (command === "config set")
    return [
      "Configuration saved",
      line("Project", data.projectRoot),
      line("Revision", data.revision),
      "Effective: next Service start",
    ].join("\n");
  if (command === "config codex" || command === "mcp init")
    return [
      `MCP configuration ${scalar(data.status)}`,
      line("IDE", data.ide),
      line("File", data.targetPath),
      ...(["created", "updated", "unchanged"].includes(String(data.status))
        ? []
        : ["", section("Proposed configuration", scalar(data.snippet))]),
    ].join("\n");
  if (command === "artifacts" || command === "records")
    return page(data, command);
  if (command === "artifact" || command === "record")
    return [
      `${command === "artifact" ? "Artifact" : "Record"} ${scalar(data.id)}`,
      line("Loom", data.loomName),
      line("Stage", data.stageName),
      ...(data.revision === undefined ? [] : [line("Revision", data.revision)]),
      line("Created", data.createdAt),
      ...(data.updatedAt === undefined
        ? []
        : [line("Updated", data.updatedAt)]),
      ...(options.exportedTo
        ? [line("Exported to", options.exportedTo)]
        : ["", section("Data", formatDetails(data.data))]),
    ].join("\n");
  return formatDetails(value);
}
export function formatResult(
  result: CoreResult<unknown>,
  options: RenderOptions = {},
): string {
  if (result.ok) return clean(formatData(result.data, options));
  return clean(
    [
      `${result.error.code}: ${result.error.message}`,
      ...(result.outcome === "applied"
        ? ["Earlier successful changes are retained."]
        : []),
      ...(result.outcome === "unknown"
        ? options.command === "build"
          ? [
              "Inspect the reported build error and output directory before rebuilding.",
            ]
          : [
              "Outcome unknown; inspect the original operation before submitting again.",
              line("Operation", result.meta.operationId),
              line("Instance", result.meta.serviceInstanceId),
              ...(result.meta.runId ? [line("Run", result.meta.runId)] : []),
              ...(result.meta.operationId && result.meta.serviceInstanceId
                ? [
                    `Next: intloom operation ${result.meta.operationId} --instance ${result.meta.serviceInstanceId}`,
                  ]
                : []),
            ]
        : []),
      ...(result.data === undefined
        ? []
        : ["", formatData(result.data, options)]),
    ].join("\n"),
  );
}
