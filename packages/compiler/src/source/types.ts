import type { CompileOptions } from "../types.ts";

export interface SourceLocation {
  readonly file: string;
  /** Lines and columns are one-based; only the file is provided when the exact position is unknown. */
  readonly line?: number;
  readonly column?: number;
}

export interface SourceText {
  readonly file: string;
  readonly text: string;
}

export interface SourceDocument {
  readonly source: SourceText;
  readonly value: unknown;
  /** Keys are JSON Pointers to document nodes. */
  readonly locations: Readonly<Record<string, SourceLocation>>;
}

export type SourceResource =
  | {
      readonly kind: "workflow" | "stage";
      readonly document: SourceDocument;
    }
  | {
      readonly kind: "agent" | "skill";
      readonly metadata: SourceDocument;
      readonly content: string;
    }
  | {
      readonly kind: "code" | "schema" | "tool" | "initializer";
      readonly source: SourceText;
    };

/** Resource file paths are absolute; business modules are read without execution. */
export interface SourceSet {
  readonly options: CompileOptions;
  readonly packageJson: SourceDocument;
  readonly resources: readonly SourceResource[];
}
