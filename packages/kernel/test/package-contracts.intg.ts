import { execFile } from "node:child_process";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));

test("built Kernel declarations constrain admissions, capabilities and private exports", async (t) => {
  const temporary = await mkdtemp(resolve(root, "test/.runtime-consumer-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  await cp(
    resolve(root, "test/fixtures/consumer/kernel.ts"),
    resolve(temporary, "consumer.ts"),
  );
  await writeFile(
    resolve(temporary, "tsconfig.json"),
    JSON.stringify({
      extends: resolve(root, "../../tsconfig.base.json"),
      compilerOptions: { noEmit: true },
      files: ["consumer.ts"],
    }),
  );
  const require = createRequire(import.meta.url);
  const tsc = resolve(
    dirname(require.resolve("typescript/package.json")),
    "bin/tsc",
  );
  try {
    await run(process.execPath, [
      tsc,
      "-p",
      resolve(temporary, "tsconfig.json"),
      "--pretty",
      "false",
    ]);
  } catch (cause) {
    throw new Error(
      cause instanceof Error && "stdout" in cause
        ? String(cause.stdout)
        : String(cause),
      { cause },
    );
  }
});
