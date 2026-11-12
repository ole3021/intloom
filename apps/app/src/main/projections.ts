import type {
  InstalledLoom,
  JsonObject,
  JsonValue,
  RunSummary,
} from "@intloom/loom-sdk";
import type { Command, PackageInfo, RunListItem } from "../shared/types";
const statusText = {
  created: "已创建",
  running: "运行中",
  waiting: "等待中",
  succeeded: "已完成",
  failed: "失败",
  interrupted: "已中断",
  stopping: "正在停止",
  cancelled: "已取消",
};
export const object = (v: JsonValue | undefined): v is JsonObject =>
  !!v && typeof v === "object" && !Array.isArray(v);
function acceptsTextOrFile(schema: JsonObject, fields: JsonObject) {
  const { prompt, files } = fields;
  if (
    Object.keys(fields).length !== 2 ||
    schema.minProperties !== 1 ||
    schema.maxProperties !== 1 ||
    schema.additionalProperties !== false ||
    schema.oneOf ||
    schema.anyOf ||
    schema.allOf ||
    (Array.isArray(schema.required) && schema.required.length) ||
    !object(prompt) ||
    prompt.type !== "string" ||
    prompt.enum ||
    !object(files) ||
    files.type !== "array" ||
    files.minItems !== 1 ||
    files.maxItems !== 1
  )
    return false;
  const item = files.items;
  if (!object(item) || item.type !== "object" || !object(item.properties))
    return false;
  const { kind, path } = item.properties;
  return (
    Object.keys(item.properties).length === 2 &&
    Array.isArray(item.required) &&
    item.required.includes("kind") &&
    item.required.includes("path") &&
    object(kind) &&
    kind.const === "input-file" &&
    object(path) &&
    path.type === "string"
  );
}
function command(
  name: string,
  description: string,
  output: string,
  schema: JsonObject,
): Command {
  const input: Command["input"] = {
    type: "object",
    properties: {},
    required: Array.isArray(schema.required)
      ? schema.required.filter((v): v is string => typeof v === "string")
      : [],
  };
  const base = { name, title: name, description, output, input };
  if (schema.type === "object" && object(schema.properties)) {
    if (acceptsTextOrFile(schema, schema.properties))
      return { ...base, textOrFile: true };
    for (const [key, f] of Object.entries(schema.properties)) {
      if (
        !object(f) ||
        (f.type !== "string" && f.type !== "integer" && f.type !== "boolean") ||
        f.enum ||
        f.oneOf
      )
        return {
          ...base,
          input: { ...input, properties: {} },
          jsonSchema: schema,
        };
      input.properties[key] = {
        type: f.type,
        title: typeof f.title === "string" ? f.title : key,
        ...(typeof f.default === "string" ||
        typeof f.default === "number" ||
        typeof f.default === "boolean"
          ? { default: f.default }
          : {}),
        ...(typeof f.minimum === "number" ? { minimum: f.minimum } : {}),
        ...(typeof f.maximum === "number" ? { maximum: f.maximum } : {}),
        ...(typeof f.minLength === "number" ? { minLength: f.minLength } : {}),
      };
    }
    if (
      !schema.oneOf &&
      !schema.anyOf &&
      !schema.allOf &&
      schema.additionalProperties === false
    )
      return base;
  }
  return { ...base, input: { ...input, properties: {} }, jsonSchema: schema };
}
export function packageInfo(id: string, loom: InstalledLoom): PackageInfo {
  const m = loom.manifest;
  const commands = loom.commands
    ? Object.entries(loom.commands).map(([name, c]) =>
        command(name, c.description, c.output, c.input),
      )
    : [
        command(
          "run",
          m.description,
          m.outcome?.description ?? "运行结果",
          m.contracts.input,
        ),
      ];
  return {
    ref: { ...loom.ref, id },
    name: m.name,
    description: m.description,
    format: "Loom",
    defaultCommand: loom.defaultCommand ?? commands[0].name,
    commands,
  };
}
export function row(summary: RunSummary): RunListItem {
  const error = summary.error;
  let message =
    error?.message ??
    summary.recoveryIssue?.message ??
    statusText[summary.status];
  if (error?.businessCode) message = `${error.businessCode} · ${error.message}`;
  else if (error?.code === "MODEL_AUTH_FAILED")
    message =
      object(error.details) && error.details.status === 403
        ? "模型服务拒绝访问（HTTP 403），请检查密钥是否有权使用该模型。"
        : "模型服务拒绝了 API 密钥（HTTP 401），请检查当前配置的密钥。";
  else if (
    error &&
    object(error.details) &&
    ((error.code === "MODEL_INCOMPLETE" &&
      error.details.finishReason === "length") ||
      (error.code === "EXECUTION_FAILED" &&
        error.details.message ===
          'Structured output was truncated because the model finished with reason "length".'))
  )
    message = "模型输出达到长度上限，结果不完整。";
  return {
    summary,
    title: [summary.loom.id, summary.command].filter(Boolean).join(" / "),
    statusLabel: statusText[summary.status],
    message,
    pending: [],
  };
}
