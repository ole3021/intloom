import { assertPortableSchema, type SchemaRole } from "../schema/portable.ts";
import type { JsonObject, LoomContracts } from "../index.ts";
import { z } from "zod";

export function projectSchema(
  schema: z.ZodType,
  role: SchemaRole,
  io: "input" | "output",
  path: string,
): JsonObject {
  assertPortableSchema(schema, role, path);
  return z.toJSONSchema(schema, {
    target: "draft-2020-12",
    io,
    cycles: "throw",
    reused: "inline",
    unrepresentable: "throw",
    // Metadata may describe a schema, but cannot override its structural contract.
    metadata: z.registry(),
    override: ({ zodSchema, jsonSchema }) => {
      const description = (zodSchema as unknown as { description?: string })
        .description;
      if (description !== undefined) jsonSchema.description = description;
    },
  }) as JsonObject;
}
export function projectContracts(
  input: z.ZodType,
  output: z.ZodType,
  path: string,
): LoomContracts {
  return {
    input: projectSchema(input, "input", "input", `${path}.inputSchema`),
    normalizedInput: projectSchema(
      input,
      "input",
      "output",
      `${path}.inputSchema`,
    ),
    output: projectSchema(output, "output", "output", `${path}.outputSchema`),
  };
}
