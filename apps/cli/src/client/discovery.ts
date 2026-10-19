import {
  projectRoot,
  readConnection,
  serviceStatus,
} from "@intloom/kernel/host";
import type { CoreMeta } from "@intloom/kernel/operations";
import { failure } from "../errors.ts";
import { projectInputSchema, type ProjectInput } from "./contracts.ts";
export async function connection(
  input: ProjectInput,
  meta: CoreMeta,
  receiptQuery = false,
) {
  projectInputSchema.parse(input);
  meta.projectRoot = await projectRoot(input.projectPath);
  const status = await serviceStatus(meta.projectRoot);
  if (
    !receiptQuery &&
    input.serviceInstanceId &&
    status.instanceId !== input.serviceInstanceId
  )
    throw failure(
      "SERVICE_INSTANCE_CHANGED",
      "The requested Service instance is no longer current.",
    );
  meta.serviceInstanceId = status.instanceId;
  const saved = await readConnection(meta.projectRoot);
  if (!saved || saved.projectRoot !== meta.projectRoot)
    throw failure(
      "CLI_SERVICE_METADATA_INVALID",
      "The project connection changed.",
    );
  return {
    url: `http://127.0.0.1:${saved.port}`,
    headers: {
      authorization: `Bearer ${saved.token}`,
      "x-intloom-request-id": meta.requestId,
      "x-intloom-service-instance":
        input.serviceInstanceId ?? status.instanceId,
    },
  };
}
