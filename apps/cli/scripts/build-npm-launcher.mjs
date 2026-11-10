import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const cli = new URL("../", import.meta.url);
const { version, license, engines, repository, publishConfig } = JSON.parse(
  readFileSync(new URL("package.json", cli), "utf8"),
);
const destination = process.argv[2];
mkdirSync(join(destination, "dist"), { recursive: true });
writeFileSync(
  join(destination, "package.json"),
  `${JSON.stringify(
    {
      name: "intloom",
      version,
      type: "module",
      license,
      engines,
      repository,
      publishConfig,
      description: "Intloom command-line launcher",
      bin: { intloom: "./dist/bin.js" },
      files: ["dist", "LICENSE", "README.md"],
      dependencies: { "@intloom/cli": version },
    },
    null,
    2,
  )}\n`,
);
copyFileSync(new URL("LICENSE", cli), join(destination, "LICENSE"));
writeFileSync(
  join(destination, "README.md"),
  "# intloom\n\nInstall with `npm install -g intloom` and run `intloom --help`. The matching version of @intloom/cli supplies the executable.\n",
);
writeFileSync(
  join(destination, "dist/bin.js"),
  '#!/usr/bin/env node\nimport "@intloom/cli/bin";\n',
  { mode: 0o755 },
);
