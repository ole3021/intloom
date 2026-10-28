import { parse, type Pattern } from "acorn";
import { fail } from "../errors.ts";

export function inspectModule(content: string, file: string) {
  let program: ReturnType<typeof parse>;
  try {
    program = parse(content, { ecmaVersion: 2025, sourceType: "module" });
  } catch (cause) {
    fail("INVALID_OUTPUT", "Invalid emitted ESM", { file }, cause);
  }
  const bindings = new Set<string>();
  const exports = new Set<string>();
  const imports = new Set<string>();
  const reexports = new Map<string, { source: string; imported: string }>();
  const values = new Map<string, { source: string; imported: string }>();
  const stars: string[] = [];
  const importedBindings = new Map<
    string,
    { source: string; imported: string }
  >();
  const origins = new Map<string, string>();
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
        importedBindings.set(item.local.name, {
          source: String(statement.source.value),
          imported:
            item.type === "ImportDefaultSpecifier"
              ? "default"
              : item.type === "ImportNamespaceSpecifier"
                ? "*"
                : item.imported.type === "Identifier"
                  ? item.imported.name
                  : String(item.imported.value),
        });
      });
  }
  for (const statement of program.body) {
    if (statement.type === "ExportDefaultDeclaration") {
      exports.add("default");
      if (statement.declaration.type === "Identifier") {
        const binding = importedBindings.get(statement.declaration.name);
        if (binding) {
          values.set("default", binding);
        }
      }
      if (
        (statement.declaration.type === "FunctionDeclaration" ||
          statement.declaration.type === "ClassDeclaration") &&
        statement.declaration.id
      )
        origins.set("default", statement.declaration.id.name);
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
        const local =
          item.local.type === "Identifier"
            ? item.local.name
            : String(item.local.value);
        const binding = statement.source
          ? { source: String(statement.source.value), imported: local }
          : importedBindings.get(local);
        if (binding) {
          reexports.set(name, binding);
        } else origins.set(name, local);
      }
    } else if (statement.type === "ExportAllDeclaration") {
      if (!statement.exported) {
        stars.push(String(statement.source.value));
        continue;
      }
      const name =
        statement.exported.type === "Identifier"
          ? statement.exported.name
          : String(statement.exported.value);
      exports.add(name);
      reexports.set(name, {
        source: String(statement.source.value),
        imported: "*",
      });
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
  return {
    imports,
    exports,
    reexports,
    values,
    stars,
    origins,
    importedBindings,
  };
}
