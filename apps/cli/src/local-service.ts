export { createServiceClient } from "./service/client.ts";
export { startLocalService, startStudioService } from "./service/start.ts";
export type {
  ServiceStatus,
  ServiceClient,
  ConfigurationSummary,
} from "./service/protocol.ts";

export async function installGlobalLoom(source: string) {
  const { installNpmPackage } = await import("./operations/prepare-npm.ts");
  const installed = await installNpmPackage(source);
  if (!installed)
    throw Error("Select a built npm Loom archive or npm package name.");
  return installed;
}

export async function removeGlobalLoom(name: string, dataDir: string) {
  const { runNpm } = await import("@intloom/kernel");
  const { requestService } = await import("./service/client.ts");
  await runNpm(["uninstall", "--global", "--", name]);
  await requestService(dataDir, "removeLoom", [name]);
}
