import { readFile, lstat } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "@babel/parser";
import type { Node, ObjectExpression } from "@babel/types";
import { PackageError } from "@intloom/loom-sdk/package-format";
import type { LoomDependencyDeclaration } from "@intloom/loom-sdk";

function unwrap(node: Node): Node {
  while (
    node.type === "TSAsExpression" ||
    node.type === "TSSatisfiesExpression" ||
    node.type === "TSNonNullExpression"
  )
    node = node.expression;
  return node;
}

export async function readDependencyDeclaration(
  project: string,
): Promise<LoomDependencyDeclaration> {
  const file = join(project, "loom.ts");
  const legacy = await lstat(join(project, "loom.dependencies.ts")).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
      return undefined;
    },
  );
  if (legacy)
    throw new PackageError(
      "DEPENDENCY_DECLARATION_INVALID",
      "Move loom.dependencies.ts declarations into defineLoom({ dependencies: { ... } }) in loom.ts, then remove the old file.",
    );
  const source = await readFile(file, "utf8");
  const statements = parse(source, {
    sourceType: "module",
    sourceFilename: file,
    plugins: ["typescript", "decorators-legacy"],
  }).program.body;
  const names = new Set<string>();
  const namespaces = new Set<string>();
  const constants = new Map<string, Node>();
  let value: Node | undefined;
  for (const statement of statements) {
    if (
      statement.type === "ImportDeclaration" &&
      statement.source.value === "@intloom/loom-sdk"
    ) {
      for (const spec of statement.specifiers) {
        if (spec.type === "ImportNamespaceSpecifier")
          namespaces.add(spec.local.name);
        if (
          spec.type === "ImportSpecifier" &&
          spec.imported.type === "Identifier" &&
          spec.imported.name === "defineLoom"
        )
          names.add(spec.local.name);
      }
    }
    const decl =
      statement.type === "ExportNamedDeclaration"
        ? statement.declaration
        : statement;
    if (decl?.type === "VariableDeclaration" && decl.kind === "const") {
      for (const item of decl.declarations)
        if (item.id.type === "Identifier" && item.init)
          constants.set(item.id.name, item.init);
    }
    if (statement.type === "ExportDefaultDeclaration")
      value = unwrap(statement.declaration);
  }
  if (value?.type === "Identifier" && constants.has(value.name))
    value = unwrap(constants.get(value.name) as Node);
  // Factory-based leaves are still supported. Full inspection checks that no hidden declarations appear.
  if (value?.type !== "CallExpression") return {};
  const callee = value.callee;
  if (
    !(
      (callee.type === "Identifier" && names.has(callee.name)) ||
      (callee.type === "MemberExpression" &&
        !callee.computed &&
        callee.object.type === "Identifier" &&
        namespaces.has(callee.object.name) &&
        callee.property.type === "Identifier" &&
        callee.property.name === "defineLoom")
    )
  )
    return {};

  function invalid(node: Node, message: string): never {
    throw new PackageError(
      "DEPENDENCY_DECLARATION_INVALID",
      `${file}:${node.loc?.start.line ?? 1}: ${message}`,
    );
  }
  function literalFields(object: ObjectExpression, path: string) {
    const result = new Map<string, Node>();
    for (const property of object.properties) {
      if (
        property.type !== "ObjectProperty" ||
        property.computed ||
        property.shorthand ||
        (property.key.type !== "Identifier" &&
          property.key.type !== "StringLiteral")
      )
        invalid(property, `${path} requires explicit literal properties.`);
      const key =
        property.key.type === "Identifier"
          ? property.key.name
          : property.key.value;
      if (result.has(key) || key === "__proto__")
        invalid(property, `Invalid or duplicate property: ${path}.${key}.`);
      result.set(key, unwrap(property.value));
    }
    return result;
  }
  const options = value.arguments[0] && unwrap(value.arguments[0]);
  if (options?.type !== "ObjectExpression")
    invalid(
      value,
      "Pass an object literal to defineLoom so dependencies can be read before compilation.",
    );
  let declaration: Node | undefined;
  let unknownKey: Node | undefined;
  for (const prop of options.properties) {
    if (prop.type === "SpreadElement" || prop.computed) {
      unknownKey = prop;
      continue;
    }
    const key =
      prop.key.type === "Identifier"
        ? prop.key.name
        : prop.key.type === "StringLiteral"
          ? prop.key.value
          : undefined;
    if (key !== "dependencies") continue;
    if (declaration || prop.type !== "ObjectProperty" || prop.shorthand)
      invalid(prop, "Declare dependencies once as an inline object literal.");
    declaration = unwrap(prop.value);
    unknownKey = undefined;
  }
  if (unknownKey)
    invalid(
      unknownKey,
      "A spread or computed key can hide dependencies. Place an explicit dependencies literal after it.",
    );
  if (!declaration) return {};
  if (declaration.type !== "ObjectExpression")
    invalid(declaration, "dependencies must be an inline object literal.");
  const dependencies: Record<string, { id: string; version: string }> =
    Object.create(null);
  for (const [alias, node] of literalFields(declaration, "dependencies")) {
    if (node.type !== "ObjectExpression")
      invalid(node, `dependencies.${alias} must be an object literal.`);
    const fields = literalFields(node, `dependencies.${alias}`);
    const id = fields.get("id"),
      version = fields.get("version");
    if (
      fields.size !== 2 ||
      id?.type !== "StringLiteral" ||
      version?.type !== "StringLiteral"
    )
      invalid(
        node,
        `dependencies.${alias} must contain exactly id and version as string literals.`,
      );
    dependencies[alias] = { id: id.value, version: version.value };
  }
  return dependencies;
}
