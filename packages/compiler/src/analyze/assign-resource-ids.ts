import { codeIdSchema, agentIdSchema } from "@intloom/loom-sdk";
import { createHash } from "node:crypto";
import { fail } from "../errors.ts";
import type { LoomModel } from "./model.ts";

/** Stable logical bindings retain the host's 21-character ID format and are namespaced across packages. */
export function assignResourceIds(model: LoomModel) {
  function ids(
    keys: string[],
    prefix: string,
  ): Readonly<Record<string, string>> {
    const used = new Set<string>();
    return Object.fromEntries(
      keys.sort().map((key) => {
        const digest = createHash("sha256")
          .update(
            JSON.stringify([model.manifest.name, model.loomName, prefix, key]),
          )
          .digest("base64url")
          .slice(0, 21);
        const id = (prefix === "CODE" ? codeIdSchema : agentIdSchema).parse(
          `${prefix}-${digest}`,
        );
        if (used.has(id))
          fail("INVALID_LOOM", `Logical resource ID collision: ${key}`);
        used.add(id);
        return [key, id];
      }),
    );
  }
  return {
    model,
    codeIds: ids(Object.keys(model.codes), "CODE"),
    agentIds: ids(Object.keys(model.agents), "AGENT"),
  };
}
