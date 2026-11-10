import type { Launch } from "../shared/types.ts";
import { catalog } from "../shared/catalog.ts";
export function validateInput(draft: Launch) {
  const pkg = catalog.find((p) => p.ref.id === draft.loom),
    command = pkg?.commands.find((c) => c.name === draft.command);
  if (!pkg || !command) throw Error("找不到选定的包或命令。");
  if (
    command.input.additionalProperties === false &&
    Object.keys(draft.input).some(
      (key) => !Object.hasOwn(command.input.properties, key),
    )
  )
    throw Error("包含未声明的输入字段。");
  for (const [key, field] of Object.entries(command.input.properties)) {
    const value = draft.input[key],
      required = command.input.required.includes(key);
    if (value === undefined && !required) continue;
    let valid: boolean;
    switch (field.type) {
      case "integer":
        valid =
          typeof value === "number" &&
          Number.isInteger(value) &&
          value >= (field.minimum ?? -Infinity) &&
          value <= (field.maximum ?? Infinity);
        break;
      case "boolean":
        valid = typeof value === "boolean";
        break;
      case "string":
        valid =
          typeof value === "string" &&
          value.length >= (field.minLength ?? 0) &&
          (!required ||
            command.input.additionalProperties === false ||
            !!value.trim());
        break;
      case "array": {
        const items = field.items;
        valid =
          Array.isArray(value) &&
          value.length >= (field.minItems ?? (required ? 1 : 0)) &&
          value.length <= (field.maxItems ?? Infinity) &&
          value.every((item) => {
            if (items?.type === "object")
              return (
                !!item &&
                typeof item === "object" &&
                "raw" in item &&
                "edited" in item &&
                typeof item.raw === "string" &&
                typeof item.edited === "string" &&
                Object.keys(item).length === 2
              );
            return (
              typeof item === "string" &&
              (!items?.pattern || new RegExp(items.pattern).test(item))
            );
          });
        break;
      }
    }
    if (!valid) throw Error(`请检查「${field.title}」的类型、数量或取值。`);
  }
  return pkg;
}
