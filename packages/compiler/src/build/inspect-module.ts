import { parse, type Pattern } from "acorn";
import { fail } from "../errors.ts";

export function inspectModule(content: string, file: string) {
  let program: ReturnType<typeof parse>;
  try {
    program = parse(content, { ecmaVersion: 2023, sourceType: "module" });
  } catch (cause) {
    fail("INVALID_OUTPUT", "Invalid emitted ESM", { file }, cause);
  }
  const bindings = new Set<string>();
  const exports = new Set<string>();
  const forwarded = new Set<string>();
  const imports = new Set<string>();
  function pattern(value: Pattern, target = bindings): void {
    if (value.type === "Identifier") target.add(value.name);
    else if (value.type === "RestElement") pattern(value.argument, target);
    else if (value.type === "AssignmentPattern") pattern(value.left, target);
    else if (value.type === "ArrayPattern")
      value.elements.forEach((item) => {
        if (item) pattern(item, target);
      });
    else if (value.type === "ObjectPattern")
      value.properties.forEach((item) => {
        pattern(
          item.type === "RestElement" ? item.argument : item.value,
          target,
        );
      });
  }
  for (const statement of program.body) {
    const declaration =
      statement.type === "ExportNamedDeclaration" ||
      statement.type === "ExportDefaultDeclaration"
        ? statement.declaration
        : statement;
    if (declaration?.type === "VariableDeclaration")
      declaration.declarations.forEach((item) => {
        pattern(item.id);
      });
    else if (
      (declaration?.type === "FunctionDeclaration" ||
        declaration?.type === "ClassDeclaration") &&
      declaration.id
    )
      bindings.add(declaration.id.name);
    if (statement.type === "ImportDeclaration")
      statement.specifiers.forEach((item) => {
        bindings.add(item.local.name);
      });
  }
  for (const statement of program.body) {
    if (statement.type === "ExportDefaultDeclaration") {
      exports.add("default");
      if (
        statement.declaration.type === "Identifier" &&
        !bindings.has(statement.declaration.name)
      )
        fail(
          "INVALID_OUTPUT",
          `Default export has no runtime binding: ${statement.declaration.name}`,
          { file },
        );
    } else if (statement.type === "ExportNamedDeclaration") {
      const declaration = statement.declaration;
      if (
        declaration?.type === "FunctionDeclaration" ||
        declaration?.type === "ClassDeclaration"
      )
        exports.add(declaration.id.name);
      else if (declaration?.type === "VariableDeclaration") {
        declaration.declarations.forEach((item) => {
          pattern(item.id, exports);
        });
      }
      for (const item of statement.specifiers) {
        const name =
          item.exported.type === "Identifier"
            ? item.exported.name
            : String(item.exported.value);
        exports.add(name);
        if (statement.source) forwarded.add(name);
      }
    } else if (
      statement.type === "ExportAllDeclaration" &&
      statement.exported
    ) {
      const name =
        statement.exported.type === "Identifier"
          ? statement.exported.name
          : String(statement.exported.value);
      exports.add(name);
      forwarded.add(name);
    }
  }
  function visit(value: unknown): void {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const node = value as Record<string, unknown>;
    if (
      [
        "ImportDeclaration",
        "ExportNamedDeclaration",
        "ExportAllDeclaration",
        "ImportExpression",
      ].includes(String(node.type)) &&
      node.source
    ) {
      const source = node.source as Record<string, unknown>;
      if (source.type !== "Literal" || typeof source.value !== "string")
        fail("INVALID_OUTPUT", "Module specifiers must be string literals", {
          file,
        });
      imports.add(source.value);
    }
    Object.values(node).forEach(visit);
  }
  visit(program);
  return { imports, exports, forwarded };
}
