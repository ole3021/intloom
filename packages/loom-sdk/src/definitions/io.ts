import type { input, output, ZodType } from "zod";

declare const ioTypes: unique symbol;
export interface DefinitionIO<I = unknown, N = unknown, O = unknown> {
  readonly [ioTypes]?: {
    readonly input: I;
    readonly normalizedInput: N;
    readonly output: O;
  };
}
export type InputOf<D> =
  D extends DefinitionIO<infer I, unknown, unknown> ? I : never;
export type NormalizedInputOf<D> =
  D extends DefinitionIO<unknown, infer N, unknown> ? N : never;
export type OutputOf<D> =
  D extends DefinitionIO<unknown, unknown, infer O> ? O : never;
export interface SchemaDefinition<
  I extends ZodType = ZodType,
  O extends ZodType = ZodType,
> extends DefinitionIO<input<I>, output<I>, output<O>> {
  readonly id: string;
  readonly description?: string;
  readonly inputSchema: I;
  readonly outputSchema: O;
}
