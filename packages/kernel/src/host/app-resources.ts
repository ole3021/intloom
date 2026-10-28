import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import type { ProjectExecution } from "./project-contracts.ts";
import { loomIdentity } from "../runtime/recovery/loom-identity.ts";
import { failure } from "../errors.ts";
import { getLogger } from "@intloom/utils";

import type { AppResource } from "../operations/ports.ts";
export function createAppResources(execution: ProjectExecution) {
  let catalog: Promise<readonly AppResource[]> | undefined;
  return () =>
    (catalog ??= (async () => {
      const resources: AppResource[] = [];
      for (const [loomName, blueprint] of Object.entries(
        execution.registries.blueprints,
      )) {
        const definition = blueprint.capability?.definition;
        const source = execution.registries.sources[loomName];
        if (!definition?.apps || !source) continue;
        const identity = await loomIdentity(source).catch(() => {
          getLogger().warn("app_resource_unavailable", { loomName });
          return undefined;
        });
        if (!identity) continue;
        for (const [appId, descriptor] of Object.entries(definition.apps)) {
          const key = createHash("sha256")
            .update(JSON.stringify([loomName, identity, appId]))
            .digest("hex")
            .slice(0, 24);
          resources.push({
            appId,
            loomName,
            loomIdentity: identity,
            descriptor,
            definition,
            uri: `ui://intloom/${encodeURIComponent(loomName)}/${identity}/${appId}`,
            toolName: `show_loom_app_${key}`,
            async readHtml() {
              const root = await realpath(source.assetRoot);
              const file = await realpath(resolve(root, descriptor.entry));
              const path = relative(root, file);
              if (path.startsWith("..") || isAbsolute(path))
                throw failure(
                  "APP_RESOURCE_UNAVAILABLE",
                  "App resource escaped its package",
                );
              const bytes = await readFile(file);
              if (
                createHash("sha256").update(bytes).digest("hex") !==
                descriptor.sha256
              )
                throw failure(
                  "APP_RESOURCE_UNAVAILABLE",
                  "App resource differs from the compiled artifact",
                );
              return bytes.toString("utf8");
            },
          });
        }
      }
      return resources;
    })());
}
