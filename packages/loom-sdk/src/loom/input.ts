import { z } from "zod";

export const absolutePathSchema = z
  .string()
  .refine(
    (value) =>
      !value.includes("\0") &&
      (value.startsWith("/") ||
        /^[A-Za-z]:[\\/]/.test(value) ||
        /^\\\\[^\\]+\\[^\\]+/.test(value)),
    "Expected a complete execution-environment path",
  );

export const loomInputSchema = z
  .strictObject({
    prompt: z.string().optional(),
    files: z.array(absolutePathSchema).readonly().optional(),
    folders: z.array(absolutePathSchema).readonly().optional(),
  })
  .readonly();

const inputFieldSchema = z.strictObject({
  required: z.boolean().default(false),
  description: z.string().optional(),
});
const listFields = {
  ...inputFieldSchema.shape,
  minItems: z.number().int().nonnegative().optional(),
  maxItems: z.number().int().nonnegative().optional(),
};
const listFieldSchema = z.strictObject(listFields);

export const inputDeclarationSchema = z
  .strictObject({
    prompt: inputFieldSchema.optional(),
    files: z
      .strictObject({
        ...listFields,
        extensions: z
          .array(z.string().regex(/^\.[a-zA-Z0-9]+$/))
          .min(1)
          .optional(),
      })
      .optional(),
    folders: listFieldSchema.optional(),
    exactlyOne: z
      .array(z.enum(["prompt", "files", "folders"]))
      .min(2)
      .optional(),
  })
  .superRefine((declaration, context) => {
    for (const name of ["files", "folders"] as const) {
      const field = declaration[name];
      if (
        field?.maxItems !== undefined &&
        Math.max(field.minItems ?? 0, field.required ? 1 : 0) > field.maxItems
      ) {
        context.addIssue({
          code: "custom",
          path: [name, "maxItems"],
          message: "Maximum conflicts with the minimum or required input",
        });
      }
    }
    if (
      declaration.exactlyOne &&
      (new Set(declaration.exactlyOne).size !== declaration.exactlyOne.length ||
        declaration.exactlyOne.some((name) => !declaration[name]) ||
        declaration.exactlyOne.filter((name) => declaration[name]?.required)
          .length > 1)
    ) {
      context.addIssue({
        code: "custom",
        path: ["exactlyOne"],
        message: "Use distinct declared fields with at most one required field",
      });
    }
  });

export type LoomInput = z.infer<typeof loomInputSchema>;
export type LoomInputDeclaration = z.infer<typeof inputDeclarationSchema>;

export function createLoomInputSchema(declaration: LoomInputDeclaration = {}) {
  return loomInputSchema.superRefine((input, context) => {
    const present = (name: "prompt" | "files" | "folders") => {
      const value = input[name];
      return typeof value === "string"
        ? Boolean(value.trim())
        : Boolean(value?.length);
    };
    for (const name of ["prompt", "files", "folders"] as const) {
      if (!declaration[name]?.required) continue;
      const value = input[name];
      if (typeof value === "string" ? !value.trim() : !value?.length) {
        context.addIssue({
          code: "custom",
          path: [name],
          message: `Required input '${name}' must not be empty`,
        });
      }
    }
    for (const name of ["files", "folders"] as const) {
      const values = input[name];
      const field = declaration[name];
      if (!values || !field) continue;
      if (
        (field.minItems !== undefined && values.length < field.minItems) ||
        (field.maxItems !== undefined && values.length > field.maxItems)
      ) {
        context.addIssue({
          code: "custom",
          path: [name],
          message: "Input count is outside the declared range",
        });
      }
    }
    if (declaration.files?.extensions)
      for (const [index, path] of (input.files ?? []).entries()) {
        const filename = path.split(/[\\/]/).at(-1) ?? "";
        const dot = filename.lastIndexOf(".");
        const extension = dot < 0 ? "" : filename.slice(dot).toLowerCase();
        if (
          !declaration.files.extensions.some(
            (allowed) => allowed.toLowerCase() === extension,
          )
        ) {
          context.addIssue({
            code: "custom",
            path: ["files", index],
            message: "File extension is not allowed",
          });
        }
      }
    if (
      declaration.exactlyOne &&
      declaration.exactlyOne.filter(present).length !== 1
    ) {
      context.addIssue({
        code: "custom",
        path: ["exactlyOne"],
        message: `Provide exactly one of: ${declaration.exactlyOne.join(", ")}`,
      });
    }
  });
}
