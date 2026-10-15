import type { CompileOptions } from "../types.ts";
import type { SourceMetadata, SourcePackage, SourceStage } from "./schemas.ts";

export interface SourceLocation {
  readonly file: string;
  /** Lines and columns are one-based; only the file is provided when the exact position is unknown. */
  readonly line?: number;
  readonly column?: number;
  readonly stageName?: string;
  readonly stepName?: string;
}

export interface SourceText {
  readonly file: string;
  readonly text: string;
}

export interface SourceDocument<T = unknown> {
  readonly source: SourceText;
  readonly value: T;
  /** Keys are JSON Pointers to document nodes. */
  readonly locations: Readonly<Record<string, SourceLocation>>;
}

export type SourceResource =
  | {
      readonly kind: "stage";
      readonly document: SourceDocument<SourceStage>;
    }
  | {
      readonly kind: "agent";
      readonly metadata: SourceDocument<SourceMetadata>;
      readonly content: string;
    }
  | {
      readonly kind: "skill";
      readonly metadata: SourceDocument<SourceMetadata>;
      readonly content: string;
      readonly assets: readonly ResourceAsset[];
    }
  | {
      readonly kind: "code" | "schema" | "tool" | "initializer";
      readonly source: SourceText;
    };

/** Resource file paths are absolute; business modules are read without execution. */
export interface SourceSet {
  readonly options: CompileOptions;
  readonly packageJson: SourceDocument<SourcePackage>;
  readonly resources: readonly SourceResource[];
  readonly references: readonly SourceReference[];
}

export interface ResourceAsset {
  readonly sourceFile: string;
  readonly outputPath: string;
}

export interface SourceReference {
  readonly fromFile: string;
  readonly reference: string;
  readonly kind: SourceResource["kind"];
  readonly file: string;
  readonly exportName: string;
  readonly location: SourceLocation;
}
