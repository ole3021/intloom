import { fileURLToPath } from "node:url";
import { compileWorkflow } from "@intloom/compiler";
import { preparePackage } from "./build/prepare-package.ts";

const packageRoot = fileURLToPath(new URL(".", import.meta.url));
await compileWorkflow({
  packageRoot,
});
await preparePackage(packageRoot);
