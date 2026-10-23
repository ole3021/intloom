import * as z from "zod";
import { loomViewSchema } from "@intloom/kernel/host";
import { addLoom, removeLoom, listInstalledLooms } from "./loom-packages.ts";
import type { ProjectInput } from "./contracts.ts";
import { local } from "./local.ts";
import { request } from "../client/http.ts";

export function createLoomOperations() {
  return {
    listLoomPackages(input: ProjectInput) {
      return local(input, (meta) => listInstalledLooms(meta.projectRoot));
    },
    addLoomPackage(input: ProjectInput & { source: string }) {
      return local(input, (meta) => addLoom(meta.projectRoot, input.source));
    },
    removeLoomPackage(input: ProjectInput & { packageName: string }) {
      return local(input, (meta) =>
        removeLoom(meta.projectRoot, input.packageName),
      );
    },
    listLooms(input: ProjectInput) {
      return request(input, "/api/v1/cli/looms", z.array(loomViewSchema));
    },
  };
}
