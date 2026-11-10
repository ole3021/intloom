import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { withBuiltPackage } from "../../../packages/compiler/dist/build-package.js";

const source = fileURLToPath(new URL("../", import.meta.url));

export async function prepareMeetingNotes(output) {
  const author = JSON.parse(
    await readFile(join(source, "package.json"), "utf8"),
  );
  await withBuiltPackage(source, async (stage) => {
    const manifestPath = join(stage, "package.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    await writeFile(
      manifestPath,
      JSON.stringify(
        {
          ...manifest,
          repository: author.repository,
          homepage:
            "https://github.com/ole3021/intloom/tree/main/examples/meeting-notes",
          publishConfig: { access: "public" },
        },
        null,
        2,
      ) + "\n",
    );
    await mkdir(output, { recursive: true });
    for (const item of ["package.json", "commands", "loom.yaml"]) {
      await cp(join(stage, item), join(output, item), {
        recursive: true,
        errorOnExist: true,
        force: false,
      });
    }
    await cp(
      new URL("../../../LICENSE", import.meta.url),
      join(output, "LICENSE"),
    );
    await cp(join(source, "README.md"), join(output, "README.md"));
  });
}

if (import.meta.main && process.argv[2]) {
  await prepareMeetingNotes(process.argv[2]);
} else if (import.meta.main) {
  const dist = join(source, "dist");
  await mkdir(dist, { recursive: true });
  const temp = await mkdtemp(join(dist, "prepare-"));
  const target = join(dist, "npm");
  try {
    const ready = join(temp, "package");
    await prepareMeetingNotes(ready);
    await rm(target, { recursive: true, force: true });
    await rename(ready, target);
    console.log(target);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
