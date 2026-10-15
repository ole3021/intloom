import type { Logger } from "@intloom/utils";
import type { CompilerDiagnostic } from "./diagnostics.ts";

export interface CompileOptions {
  readonly logger?: Logger;
  readonly packageRoot: string;
  readonly tsconfigFile?: string;
}

export interface CompileResult {
  readonly packageRoot: string;
  readonly outputPath: string;
  readonly packageName: string;
  readonly packageVersion: string;
  readonly loomName: string;
  readonly diagnostics: readonly CompilerDiagnostic[];
}
