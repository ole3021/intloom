import { LoomError } from "@intloom/utils";
import type { CompilerErrorCode } from "./errors.ts";
import type { SourceLocation } from "./source/types.ts";

export interface CompilerDiagnostic {
  readonly severity: "error" | "warning";
  readonly code: CompilerErrorCode | "UNREACHABLE_STAGE" | "UNREACHABLE_STEP";
  readonly message: string;
  readonly location?: SourceLocation;
  readonly related?: readonly SourceLocation[];
}

export function formatDiagnostic(diagnostic: CompilerDiagnostic): string {
  const at = diagnostic.location;
  const scope = [at?.stageName, at?.stepName].filter(Boolean).join(" / ");
  const where = at
    ? `${at.file}${at.line ? `:${at.line}:${at.column ?? 1}` : ""}: `
    : "";
  return `${where}${scope ? `[${scope}] ` : ""}${diagnostic.message}`;
}

export function failDiagnostics(
  code: CompilerErrorCode,
  diagnostics: readonly CompilerDiagnostic[],
  cause?: unknown,
): never {
  throw new LoomError(code, diagnostics.map(formatDiagnostic).join("\n"), {
    cause: { location: diagnostics[0]?.location, diagnostics, cause },
  });
}
