import { createScanner, SyntaxKind } from "typescript/unstable/ast";

export interface DeclarationReference {
  readonly kind: "module" | "path" | "types";
  readonly specifier: string;
  readonly start: number;
  readonly end: number;
}

/** Scan emitted declarations, including import types and triple-slash references, without executing modules. */
export function declarationReferences(text: string): DeclarationReference[] {
  const scanner = createScanner(false, undefined, text);
  const tokens: {
    kind: SyntaxKind;
    value: string;
    start: number;
    end: number;
  }[] = [];
  const references: DeclarationReference[] = [];
  for (
    let kind = scanner.scan();
    kind !== SyntaxKind.EndOfFile;
    kind = scanner.scan()
  ) {
    if (kind === SyntaxKind.SingleLineCommentTrivia) {
      const match =
        /^\/\/\/\s*<reference\s+(path|types)\s*=\s*["']([^"']+)["']/.exec(
          scanner.getTokenText(),
        );
      if (match?.[1] && match[2])
        references.push({
          kind: match[1] as "path" | "types",
          specifier: match[2],
          start: scanner.getTokenStart(),
          end: scanner.getTokenEnd(),
        });
    }
    if (kind <= SyntaxKind.ConflictMarkerTrivia) continue;
    tokens.push({
      kind,
      value: scanner.getTokenValue(),
      start: scanner.getTokenStart(),
      end: scanner.getTokenEnd(),
    });
  }
  tokens.forEach((token, i) => {
    if (token.kind !== SyntaxKind.StringLiteral) return;
    const previous = tokens[i - 1]?.kind;
    const before = tokens[i - 2]?.kind;
    if (
      previous === SyntaxKind.FromKeyword ||
      previous === SyntaxKind.ImportKeyword ||
      (previous === SyntaxKind.OpenParenToken &&
        (before === SyntaxKind.ImportKeyword ||
          before === SyntaxKind.RequireKeyword))
    )
      references.push({
        kind: "module",
        specifier: token.value,
        start: token.start,
        end: token.end,
      });
  });
  return references;
}
