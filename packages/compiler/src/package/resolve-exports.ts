import { dirname, resolve } from "node:path";
import { fail } from "../errors.ts";
import { isPathWithin } from "../source/references.ts";
import type { inspectModule } from "./inspect-module.ts";

/** Resolve local ESM bindings through named/star/alias exports; repeated paths to one binding are not ambiguous. */
export async function resolveExportOrigins(
  file: string,
  name: string,
  output: string,
  moduleInfo: (file: string) => Promise<ReturnType<typeof inspectModule>>,
  visiting = new Set<string>(),
): Promise<Set<string>> {
  const key = JSON.stringify([file, name]);
  if (visiting.has(key)) return new Set();
  const next = new Set(visiting).add(key);
  const info = await moduleInfo(file);
  const forward = async (
    specifier: string,
    imported: string,
  ): Promise<Set<string>> => {
    if (!specifier.startsWith("."))
      return new Set([JSON.stringify([specifier, imported])]);
    const target = resolve(dirname(file), specifier);
    if (!isPathWithin(output, target))
      fail("INVALID_OUTPUT", `Import escapes output: ${specifier}`, { file });
    if (imported === "*") {
      await moduleInfo(target);
      return new Set([`${target}:*`]);
    }
    return resolveExportOrigins(target, imported, output, moduleInfo, next);
  };
  // `export default importedValue` creates its own binding, unlike `export { value as default }`.
  const value = info.values.get(name);
  if (value) {
    const origins = await forward(value.source, value.imported);
    return origins.size === 1
      ? new Set([JSON.stringify([file, name])])
      : origins;
  }
  const ref = info.reexports.get(name);
  if (ref) return forward(ref.source, ref.imported);
  if (info.exports.has(name))
    return new Set([JSON.stringify([file, info.origins.get(name) ?? name])]);
  const found = new Set<string>();
  if (name !== "default")
    for (const specifier of info.stars)
      for (const origin of await forward(specifier, name)) found.add(origin);
  return found;
}
