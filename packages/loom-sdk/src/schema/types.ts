import type { input, output, ZodType } from "zod";

export type SchemaInput<S extends ZodType> = input<S>;
export type SchemaOutput<S extends ZodType> = output<S>;
