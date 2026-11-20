import { z } from "zod";

export const relativePathSchema = z
  .string()
  .min(1)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !/^[A-Za-z]:/.test(value) &&
      !/[\\\0*?[\]{}]/.test(value) &&
      !value.split("/").includes("..") &&
      value.split("/").some((part) => part !== "" && part !== "."),
    "Use a concrete package-relative path without '..', backslashes or globs",
  );

const singleOutput = {
  path: relativePathSchema,
  description: z.string().optional(),
};

export const outputSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("markdown"), ...singleOutput }),
  z.strictObject({ type: z.literal("file"), ...singleOutput }),
  z.strictObject({ type: z.literal("folder"), ...singleOutput }),
  z.strictObject({
    type: z.literal("files"),
    paths: z.array(relativePathSchema).min(1),
    description: z.string().optional(),
  }),
]);

export const outputsSchema = z
  .record(z.string().min(1), outputSchema)
  .refine(
    (outputs) => !outputs.summary || outputs.summary.type === "markdown",
    { message: "The summary output must be markdown", path: ["summary"] },
  );

export type LoomOutput = z.infer<typeof outputSchema>;
export type LoomOutputs = z.infer<typeof outputsSchema>;
