import { toStandardSchema } from "@mastra/schema-compat/adapters/json-schema";

export function toolSchema(schema: unknown) {
  return toStandardSchema(schema as Parameters<typeof toStandardSchema>[0], {
    // The pinned adapter's bundled Ajv constructor declaration omits options.
    // @ts-expect-error Runtime options are supported and covered by schema.spec.ts.
    ajvOptions: { logger: false },
  });
}
