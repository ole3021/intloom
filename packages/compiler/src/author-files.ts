import { createHash } from "node:crypto";
import { readFile, readdir, realpath, lstat } from "node:fs/promises";
import { basename, join } from "node:path";
import type { Plugin } from "esbuild";
import { parse } from "yaml";
import { z } from "zod";
import { assertPackagePath } from "@intloom/loom-sdk/package-format";

export function authorFiles(root: string): Plugin {
  return {
    name: "intloom-author-files",
    setup(builder) {
      builder.onResolve({ filter: /^intloom:(agent|skill)\// }, ({ path }) => {
        const slash = path.indexOf("/");
        const relative = path.slice(slash + 1);
        assertPackagePath(relative);
        return { namespace: path.slice(0, slash), path: relative };
      });
      for (const kind of ["agent", "skill"] as const) {
        builder.onLoad(
          { filter: /.*/, namespace: `intloom:${kind}` },
          async ({ path }) => {
            const source = kind === "skill" ? join(path, "SKILL.md") : path;
            if (!source.endsWith(".md"))
              throw Error("Agent source must be Markdown.");
            const full = join(root, source);
            if ((await realpath(full)) !== join(await realpath(root), source))
              throw Error("Linked author files are unsupported.");
            const contents = await readFile(full, "utf8");
            const match = /^---\r?\n([\s\S]*?)\r?\n---\s*\n([\s\S]*)$/.exec(
              contents,
            );
            if (match?.[1] === undefined || !match[2]?.trim())
              throw Error("Expected Markdown front matter and instructions.");
            const fields = z.object({
              name: z.string().min(1),
              description: z.string().trim().min(1),
            });
            const { name, description } = (
              kind === "agent" ? fields.strict() : fields
            ).parse(parse(match[1]));
            if (kind === "agent")
              return {
                contents:
                  "export default " +
                  JSON.stringify({
                    id: name,
                    description,
                    instructions: match[2].trim(),
                  }),
              };
            if (
              basename(path) !== name ||
              name.length > 64 ||
              !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)
            )
              throw Error("Skill name must match its directory.");
            const resources = [];
            for (const rel of (
              await readdir(join(root, path), { recursive: true })
            ).sort()) {
              if (rel.split("/").some((part) => part.startsWith("."))) continue;
              const entry = await lstat(join(root, path, rel));
              if (entry.isDirectory()) continue;
              if (!entry.isFile())
                throw Error(`Unsupported Skill entry: ${rel}`);
              resources.push({
                kind: "resource",
                id:
                  "skill-" +
                  createHash("sha256").update(`${name}/${rel}`).digest("hex"),
                path: join(path, rel),
                packagePath: `skills/${name}/${rel}`,
              });
            }
            const instructions = resources.find((r) => r.path === source);
            return {
              contents:
                "export default " +
                JSON.stringify({
                  kind: "skill",
                  id: name,
                  description,
                  instructions,
                  resources: resources.filter((r) => r !== instructions),
                }),
            };
          },
        );
      }
    },
  };
}
