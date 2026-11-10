import * as p from "@clack/prompts";
import { statSync } from "node:fs";
import { resolve, sep } from "node:path";
import {
  IntloomError,
  type JsonObject,
  type JsonValue,
} from "@intloom/loom-sdk";
import { answer, choose, menu, terminalIO } from "./prompts.ts";

function enumValues(schema: JsonObject) {
  return Array.isArray(schema.enum) ? schema.enum : undefined;
}

export async function pathList(name: "files" | "paths") {
  const files = name === "files";
  const paths: string[] = [];
  for (;;) {
    const options = [
      {
        value: "pick",
        label: files ? "Select a file" : "Select an existing path",
      },
    ];
    if (!files)
      options.push({
        value: "enter",
        label: "Enter a path (may not exist yet)",
      });
    if (paths.length)
      options.unshift(
        { value: "done", label: "Done" },
        { value: "remove", label: "Remove the last item" },
      );
    const action = await menu(
      paths.length ? `Selected ${paths.length} · ${paths.at(-1)}` : name,
      options,
    );
    if (action === "done") return paths;
    if (action === "remove") {
      paths.pop();
      continue;
    }
    const picked =
      action === "enter"
        ? answer(
            await p.text({
              ...terminalIO,
              message: "Path",
              validate: (v) => (v?.trim() ? undefined : "Enter a path"),
            }),
          )
        : answer(
            await p.path({
              ...terminalIO,
              message: files ? "Select a file" : "Select a file or directory",
              root: process.cwd() + sep,
              validate: (v) =>
                files &&
                (!v || !statSync(v, { throwIfNoEntry: false })?.isFile())
                  ? "Select an existing file"
                  : undefined,
            }),
          );
    paths.push(resolve(picked));
  }
}

export async function formValue(
  schema: JsonObject,
  name: string,
): Promise<JsonValue> {
  const message = [schema.title ?? name, schema.description]
    .filter(Boolean)
    .join(" · ");
  const bounds = [
    schema.minimum !== undefined && schema.minimum !== Number.MIN_SAFE_INTEGER
      ? `≥ ${schema.minimum}`
      : "",
    schema.maximum !== undefined && schema.maximum !== Number.MAX_SAFE_INTEGER
      ? `≤ ${schema.maximum}`
      : "",
  ]
    .filter(Boolean)
    .join(", ");
  const common = {
    ...terminalIO,
    message: bounds ? `${message} (${bounds})` : message,
  };
  const choices = enumValues(schema);
  if (choices?.length)
    return choices[await choose(message, choices.map(String))] as JsonValue;
  if ("const" in schema) return schema.const as JsonValue;
  if (schema.type === "boolean")
    return answer(
      await p.confirm({
        ...common,
        initialValue: false,
        active: "Yes",
        inactive: "No",
      }),
    );
  if (
    schema.type === "object" &&
    schema.properties &&
    typeof schema.properties === "object" &&
    !Array.isArray(schema.properties)
  ) {
    const values: JsonObject = {};
    const properties = schema.properties as Record<string, JsonObject>;
    for (const key of (schema.required ?? []) as string[]) {
      values[key] = await formValue(properties[key] ?? {}, key);
    }
    return values;
  }
  if (schema.type === "array") {
    const items = schema.items as JsonObject | undefined;
    const options = items && enumValues(items);
    if (options?.length) {
      // General arrays may contain repetitions and carry order; retain the JSON route.
      if (
        schema.uniqueItems === true ||
        (await choose(message, [
          "Choose items",
          "Enter ordered JSON (duplicates allowed)",
        ])) === 0
      ) {
        const indices = answer(
          await p.multiselect({
            ...common,
            options: options.map((v, i) => ({ value: i, label: String(v) })),
            required: Number(schema.minItems ?? 0) > 0,
          }),
        );
        return indices.map((i) => options[i] as JsonValue);
      }
    }
  }
  if (schema.type === "string") {
    const long =
      /body|text|prompt|note|comment|description|reason|意见|说明|正文/i.test(
        name,
      ) || name === "Answer";
    if (!long) {
      const text = answer(
        await p.text({
          ...common,
          placeholder: "Enter text, or /multiline to open the editor",
        }),
      );
      // Keep the original shortcut as an input alias; the displayed command is English.
      if (text !== "/multiline" && text !== "/多行") return text;
    }
    return answer(
      await p.multiline({
        ...common,
        message: `${message} · Enter for a new line; Tab, then Enter to submit`,
        showSubmit: true,
      }),
    );
  }
  const numeric = schema.type === "number" || schema.type === "integer";
  const parse = (v: string) => JSON.parse(v) as JsonValue;
  const validate = (v: string | undefined) => {
    try {
      const value = parse(v ?? "");
      if (numeric && typeof value !== "number") return "Enter a number";
    } catch {
      return "Enter valid JSON";
    }
    return undefined;
  };
  const raw = numeric
    ? await p.text({ ...common, validate })
    : await p.multiline({
        ...common,
        message: `${message} · JSON; Tab, then Enter to submit`,
        showSubmit: true,
        validate,
      });
  return parse(answer(raw));
}

// The Intloom service identifies rejected fields. Keep the user's complete draft editable.
export async function correctValue(
  error: unknown,
  code: string,
  value: unknown,
  schema: JsonObject,
) {
  if (!(error instanceof IntloomError) || error.code !== code) throw error;
  const details = error.details as { paths?: string[] } | undefined;
  const paths = details?.paths?.filter(Boolean).join(", ");
  const key = details?.paths?.[0];
  const properties = schema.properties as
    | Record<string, JsonObject>
    | undefined;
  if (
    key &&
    properties &&
    Object.hasOwn(properties, key) &&
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    const field = properties[key] as JsonObject;
    process.stderr.write(
      `Edit ${key} · Current value: ${JSON.stringify((value as JsonObject)[key])}\n`,
    );
    return { ...value, [key]: await formValue(field, key) } as JsonObject;
  }
  return JSON.parse(
    answer(
      await p.multiline({
        ...terminalIO,
        message: `Edit ${paths || "Input"} · JSON; Tab, then Enter to submit`,
        initialValue: JSON.stringify(value, null, 2) ?? "",
        showSubmit: true,
        validate: (text) => {
          try {
            JSON.parse(text ?? "");
          } catch {
            return "Enter valid JSON";
          }
        },
      }),
    ),
  ) as JsonValue;
}
