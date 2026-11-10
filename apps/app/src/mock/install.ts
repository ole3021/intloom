import { catalog } from "../shared/catalog.ts";
import type { LoomInstallPreview } from "../shared/types.ts";
export function mockInstallPreview(
  input: string,
  installed: string[],
): LoomInstallPreview[] {
  const source = input.trim().replace(/\/$/, "");
  const pkg = catalog.find(({ ref }) =>
    [
      ref.id,
      ref.id + "@" + ref.version,
      ref.id + "@latest",
      "https://www.npmjs.com/package/" + ref.id,
      "https://www.npmjs.com/package/" + ref.id + "/v/" + ref.version,
      "https://github.com/example/" + ref.id,
    ].includes(source),
  );
  if (!pkg) throw Error("演练模式仅支持示例 Loom，请选择下方的示例包。");
  return [
    {
      ...pkg.ref,
      name: pkg.name,
      description: pkg.description,
      spec: pkg.ref.id,
      sourceLabel: source.startsWith("https://github.com/")
        ? "演练 · GitHub · example/" + pkg.ref.id + " · v" + pkg.ref.version
        : "演练 · npm",
      integrity: pkg.ref.artifactDigest,
      ...(installed.includes(pkg.ref.id) && {
        installed: "same",
        installedVersion: pkg.ref.version,
      }),
    },
  ];
}
