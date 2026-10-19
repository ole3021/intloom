import { createHash } from "node:crypto";
import { errorView, failure } from "../errors.ts";
import type { OperationReceipt, OperationQuery } from "./api-contracts.ts";
import type { RunView } from "../runtime/run-view.ts";
import type { RunSource } from "../runtime/execution-policy.ts";

import type { MutationResult } from "../runtime/mutation.ts";

function requestHash(value: unknown): string {
  const canonical = JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );
  return createHash("sha256").update(canonical).digest("hex");
}

/** One ledger per project host instance, shared by every transport. Pending and settled records have the same lifetime. */
export function createOperationReceipts(serviceInstanceId: string) {
  const records = new Map<
    string,
    { hash: string; receipt: OperationReceipt }
  >();
  return {
    get(instanceId: string, operationId: string): OperationQuery {
      if (instanceId !== serviceInstanceId)
        return { status: "instance_changed", serviceInstanceId };
      const record = records.get(operationId);
      return record
        ? { status: "found", receipt: structuredClone(record.receipt) }
        : { status: "not_found", serviceInstanceId };
    },
    async admit(
      request: {
        serviceInstanceId: string;
        operationId: string;
        kind: OperationReceipt["kind"];
        source: RunSource;
        target?: string;
        parameters: unknown;
      },
      apply: () => Promise<MutationResult<RunView>>,
    ): Promise<OperationReceipt> {
      if (request.serviceInstanceId !== serviceInstanceId)
        throw failure(
          "SERVICE_INSTANCE_CHANGED",
          "The requested Service instance changed.",
        );
      const hash = requestHash(request);
      const known = records.get(request.operationId);
      if (known) {
        if (known.hash !== hash)
          throw failure(
            "OPERATION_CONFLICT",
            "The operation ID is already bound to different parameters.",
          );
        return structuredClone(known.receipt);
      }
      const base = {
        serviceInstanceId,
        operationId: request.operationId,
        kind: request.kind,
      };
      const record: { hash: string; receipt: OperationReceipt } = {
        hash,
        receipt: { ...base, status: "pending" },
      };
      records.set(request.operationId, record);
      let result: MutationResult<RunView>;
      try {
        result = await apply();
      } catch (error) {
        result = { status: "indeterminate", error };
      }
      if (result.status === "applied") {
        const run = result.value;
        record.receipt = {
          ...base,
          status: "accepted",
          runId: run.runId,
          acceptedAt: new Date().toISOString(),
          acceptedRevision: run.revision ?? 1,
        };
      } else
        record.receipt =
          result.status === "not_applied"
            ? { ...base, status: "rejected", error: errorView(result.error) }
            : {
                ...base,
                status: "indeterminate",
                error: errorView(result.error),
                ...(result.runId ? { runId: result.runId } : {}),
              };
      return structuredClone(record.receipt);
    },
  };
}
export type OperationReceipts = ReturnType<typeof createOperationReceipts>;
