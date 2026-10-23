import { startService, stopService } from "@intloom/kernel/host";
import { serviceApiInfoSchema } from "@intloom/kernel/operations";
import { diagnoseProject } from "@intloom/kernel/host";
import { failure } from "../errors.ts";
import type { ProjectInput } from "./contracts.ts";
import { local } from "./local.ts";
import { request } from "../client/http.ts";

export function createServiceOperations() {
  return {
    async getServiceStatus(input: ProjectInput) {
      return local(input, async (meta) => {
        const diagnosis = await diagnoseProject(meta.projectRoot);
        if (diagnosis.status === "running" && diagnosis.service) {
          meta.serviceInstanceId = diagnosis.service.instanceId;
          const info = await request(
            input,
            "/api/v1/service",
            serviceApiInfoSchema,
          );
          if (!info.ok) throw failure(info.error.code, info.error.message);
          return {
            status: "running" as const,
            projectRoot: meta.projectRoot,
            service: info.data,
          };
        }
        return diagnosis.status === "offline"
          ? { status: "stopped" as const, projectRoot: meta.projectRoot }
          : {
              status: "unavailable" as const,
              projectRoot: meta.projectRoot,
              diagnostic: {
                code: "CLI_SERVICE_UNAVAILABLE",
                message: diagnosis.message,
                retryable: false,
              },
            };
      });
    },
    startService(input: ProjectInput & { readonly port?: number }) {
      return local(input, async (meta) => {
        const result = await startService({
          projectRoot: meta.projectRoot,
          ...(input.port === undefined ? {} : { port: input.port }),
        });
        meta.serviceInstanceId = result.service.instanceId;
        return result;
      });
    },
    stopService(input: ProjectInput) {
      return local(input, (meta) =>
        stopService(meta.projectRoot, input.serviceInstanceId),
      );
    },
  };
}
