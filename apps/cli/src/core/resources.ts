import {
  artifactPageSchema,
  storedArtifactSchema,
  type ArtifactQuery,
} from "@intloom/kernel/operations";
import {
  storedRecordSchema,
  recordPageSchema,
} from "@intloom/kernel/operations";
import type { ProjectInput } from "./contracts.ts";

import { request } from "../client/http.ts";

export function createResourcesOperations() {
  return {
    getArtifact(
      input: ProjectInput &
        (
          | {
              readonly artifactId: string;
              readonly loomName?: never;
              readonly stageName?: never;
            }
          | {
              readonly artifactId?: never;
              readonly loomName: string;
              readonly stageName: string;
            }
        ),
    ) {
      const selector =
        input.artifactId !== undefined
          ? { artifactId: input.artifactId }
          : { loomName: input.loomName, stageName: input.stageName };
      return request(
        input,
        `/api/v1/cli/artifact?${new URLSearchParams(selector)}`,
        storedArtifactSchema.nullable(),
      );
    },
    listArtifacts(input: ProjectInput & { readonly query?: ArtifactQuery }) {
      const query = new URLSearchParams(
        Object.entries(input.query ?? {}).map(
          ([key, value]): [string, string] => [key, String(value)],
        ),
      );
      return request(
        input,
        `/api/v1/cli/artifacts?${query}`,
        artifactPageSchema,
      );
    },
    getRecord(input: ProjectInput & { readonly recordId: string }) {
      return request(
        input,
        `/api/v1/cli/records/${encodeURIComponent(input.recordId)}`,
        storedRecordSchema.nullable(),
      );
    },
    listRecords(input: ProjectInput & { readonly query?: ArtifactQuery }) {
      return request(
        input,
        `/api/v1/cli/records?${new URLSearchParams(Object.entries(input.query ?? {}).map(([key, value]): [string, string] => [key, String(value)]))}`,
        recordPageSchema,
      );
    },
  };
}
