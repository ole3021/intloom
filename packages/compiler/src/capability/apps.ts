import { createHash } from "node:crypto";
import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import { parse as parseJavaScript } from "acorn";
import type { LoomDefinition } from "@intloom/loom-sdk";
import type { CompiledApp } from "@intloom/loom-sdk/compiled";
import type { ResourceAsset } from "../source/types.ts";
import { isPathWithin } from "../source/references.ts";
import { fail } from "../errors.ts";

/** Checks discoverable dependencies only; the host CSP also blocks dynamic loads. */
export function validateAppHtml(html: string, file: string): void {
  function reject(message: string): never {
    return fail("INVALID_REFERENCE", `App must be self-contained: ${message}`, {
      file,
    });
  }
  const css = (value: string) => {
    if (/@import\b/i.test(value)) reject("CSS imports are unsupported");
    for (const match of value.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi))
      if (!/^(data:|#)/i.test(match[2] ?? "")) reject("external CSS resource");
  };
  function visit(node: DefaultTreeAdapterMap["node"]): void {
    if ("tagName" in node) {
      const tag = node.tagName;
      if (tag === "script") {
        const type = node.attrs.find(
          (attribute) => attribute.name === "type",
        )?.value;
        if (
          !type ||
          ["module", "text/javascript", "application/javascript"].includes(type)
        ) {
          const source = node.childNodes
            .map((child) => ("value" in child ? child.value : ""))
            .join("");
          let ast: unknown;
          try {
            ast = parseJavaScript(source, {
              ecmaVersion: 2025,
              sourceType: type === "module" ? "module" : "script",
            });
          } catch {
            reject("invalid inline JavaScript");
          }
          function inspect(value: unknown): void {
            if (!value || typeof value !== "object") return;
            if (Array.isArray(value)) {
              for (const item of value) inspect(item);
              return;
            }
            const item = value as Record<string, unknown>;
            if (
              item.type === "ImportDeclaration" ||
              item.type === "ImportExpression" ||
              ((item.type === "ExportAllDeclaration" ||
                item.type === "ExportNamedDeclaration") &&
                item.source)
            )
              reject("module imports must be bundled into the HTML");
            for (const child of Object.values(item)) inspect(child);
          }
          inspect(ast);
        }
      }
      if (["base", "iframe", "object", "embed"].includes(tag))
        reject(`unsupported ${tag} element`);
      for (const { name, value } of node.attrs) {
        if (name === "style") css(value);
        if (name === "srcset" || name === "action" || name === "formaction")
          reject(`unsupported ${name}`);
        if (
          ["src", "href", "xlink:href", "poster", "data"].includes(name) &&
          !(
            value.startsWith("#") ||
            (tag !== "script" && /^data:/i.test(value))
          )
        )
          reject(`external ${tag}.${name}`);
        if (tag === "script" && name === "src")
          reject("scripts must be inline");
        if (
          tag === "meta" &&
          name === "http-equiv" &&
          value.toLowerCase() === "refresh"
        )
          reject("automatic navigation");
      }
      if (tag === "style")
        for (const child of node.childNodes)
          if ("value" in child) css(child.value);
      if (tag === "template")
        visit((node as DefaultTreeAdapterMap["template"]).content);
    }
    if ("childNodes" in node) for (const child of node.childNodes) visit(child);
  }
  if (!/<html[\s>]/i.test(html)) reject("an HTML document is required");
  visit(parse(html));
}

export async function collectApps(
  root: string,
  declarations: LoomDefinition["apps"],
) {
  const apps: Record<string, CompiledApp> = {};
  const assets: ResourceAsset[] = [];
  for (const [id, app] of Object.entries(declarations ?? {})) {
    const directory = resolve(root, app.path);
    const entry = resolve(directory, app.entry);
    if (
      !app.path.startsWith("./") ||
      !isPathWithin(root, directory) ||
      !isPathWithin(directory, entry) ||
      !/\.html$/i.test(entry)
    )
      fail(
        "INVALID_REFERENCE",
        "App directory and HTML entry must stay inside the package",
        { file: entry },
      );
    if (
      (await lstat(directory)).isSymbolicLink() ||
      !isPathWithin(root, await realpath(directory))
    )
      fail("INVALID_REFERENCE", "App directory symlinks are unsupported", {
        file: directory,
      });
    async function walk(path: string): Promise<void> {
      for (const item of await readdir(path, { withFileTypes: true })) {
        const file = resolve(path, item.name);
        if (
          item.isSymbolicLink() ||
          item.name.startsWith(".") ||
          item.name === "node_modules"
        )
          fail(
            "INVALID_REFERENCE",
            "App resources must not contain symlinks, hidden files or dependencies",
            { file },
          );
        if (item.isDirectory()) await walk(file);
        else if (item.isFile())
          assets.push({
            sourceFile: file,
            outputPath: `apps/${id}/${relative(directory, file).replaceAll("\\", "/")}`,
          });
        else
          fail("INVALID_REFERENCE", "App resources must be regular files", {
            file,
          });
      }
    }
    await walk(directory);
    const bytes = await readFile(entry);
    validateAppHtml(bytes.toString("utf8"), entry);
    apps[id] = {
      type: "html",
      entry: `apps/${id}/${relative(directory, entry).replaceAll("\\", "/")}`,
      mimeType: "text/html;profile=mcp-app",
      sha256: createHash("sha256").update(bytes).digest("hex"),
      protocolVersion: "1",
    };
  }
  return { apps, assets };
}
