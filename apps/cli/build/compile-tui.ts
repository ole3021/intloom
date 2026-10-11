import { transformAsync } from "@babel/core";
import typescript from "@babel/preset-typescript";
import solid from "babel-preset-solid";
import moduleResolver from "babel-plugin-module-resolver";
import { mkdir, readdir, readFile, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url)).replace(/\/$/u, "");

async function compile(directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await compile(path);
      continue;
    }
    if (!/\.tsx?$/u.test(path) || /\.spec\.tsx?$/u.test(path)) continue;
    const compiled = await transformAsync(await readFile(path, "utf8"), {
      filename: path,
      babelrc: false,
      configFile: false,
      plugins: [
        [
          moduleResolver,
          {
            resolvePath(specifier: string) {
              if (specifier === "solid-js") return "solid-js/dist/solid.js";
              if (specifier === "solid-js/store")
                return "solid-js/store/dist/store.js";
              return specifier.startsWith(".")
                ? specifier.replace(/\.tsx?$/u, ".js")
                : specifier;
            },
          },
        ],
      ],
      presets: [
        [solid, { moduleName: "@opentui/solid", generate: "universal" }],
        [typescript],
      ],
    });
    if (!compiled?.code) throw new Error(`No compiled code: ${path}`);
    const output = resolve(
      path.replace(`${root}/src/`, `${root}/dist/`).replace(/\.tsx?$/u, ".js"),
    );
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${compiled.code}\n`);
    if (path.endsWith(".tsx")) {
      await rm(output.replace(/\.js$/u, ".jsx"), { force: true });
      await rm(`${output.replace(/\.js$/u, ".jsx")}.map`, { force: true });
    }
  }
}

await compile(resolve(root, "src/tui"));
