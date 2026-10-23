import { defineCommand } from "citty";
import { loomSource } from "@intloom/kernel/host";
import type { CmdContext } from "../context.ts";
import { pos, value } from "../arguments.ts";
export function createLoomsCommands(context: CmdContext) {
  const { core, io, print, leaf } = context;
  return {
    looms: leaf("Loaded Loom readiness", {}, async (_a, p) =>
      print(await core.listLooms(p)),
    ),
    loom: defineCommand({
      meta: { description: "Offline Loom packages" },
      subCommands: {
        list: leaf("Declarations and installation", {}, async (_a, p) =>
          print(await core.listLoomPackages(p)),
        ),
        add: leaf(
          "Install package",
          { source: pos("Package/archive") },
          async (a, p) =>
            print(
              await core.addLoomPackage({
                ...p,
                source: loomSource(value(a, "source", true), io.cwd),
              }),
            ),
        ),
        remove: leaf(
          "Remove declaration; retain data",
          { name: pos("Package name or unambiguous short name") },
          async (a, p) =>
            print(
              await core.removeLoomPackage({
                ...p,
                packageName: value(a, "name", true),
              }),
            ),
        ),
      },
    }),
  };
}
