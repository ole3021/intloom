import { IntloomError } from "@intloom/loom-sdk";
import {
  type Server,
  ProtocolError,
  ProtocolErrorCode,
} from "@modelcontextprotocol/server";
import {
  maximumBytes,
  publicError,
  type ServiceClient,
} from "../service/protocol.ts";

export const resourceUri = (artifactId: string) =>
  `intloom://artifacts/${encodeURIComponent(artifactId)}`;

export function registerResources(server: Server, client: ServiceClient) {
  server.setRequestHandler("resources/list", async ({ params }) => {
    try {
      const page = await client("getArtifactCatalog", [
        params?.cursor ? { cursor: params.cursor } : {},
      ]);
      return {
        resources: page.items.map((a) => ({
          uri: resourceUri(a.id),
          name: a.name,
          mimeType: a.mediaType,
          size: a.size,
        })),
        ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
      };
    } catch (error) {
      const projected = publicError(error);
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        projected.message,
        projected,
      );
    }
  });
  server.setRequestHandler("resources/templates/list", async () => ({
    resourceTemplates: [],
  }));
  server.setRequestHandler("resources/read", async ({ params }) => {
    const matched = /^intloom:\/\/artifacts\/([A-Za-z0-9_-]+)$/.exec(
      params.uri,
    );
    if (!matched)
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        "Expected an Intloom artifact URI.",
      );
    const artifactId = matched[1] as string;
    try {
      const artifact = await client("getArtifact", [artifactId]);
      if ((artifact.size * 4) / 3 > maximumBytes - 4096)
        throw new IntloomError(
          "RESULT_TOO_LARGE",
          "Full resource exceeds 8 MiB; use intloom_artifact_read ranges or CLI artifact export.",
          { artifactId, runId: artifact.runId },
        );
      const chunks: Buffer[] = [];
      let offset = 0;
      while (true) {
        const range = await client("readArtifact", [{ artifactId, offset }]);
        chunks.push(Buffer.from(range.data, "base64"));
        offset += range.length;
        if (range.eof) break;
      }
      const bytes = Buffer.concat(chunks);
      let text: string | undefined;
      if (
        /^(text\/|application\/(?:json|xml|javascript)(?:;|$)|application\/[\w.-]+\+(?:json|xml)(?:;|$))/.test(
          artifact.mediaType,
        )
      ) {
        try {
          text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        } catch {
          /* Invalid UTF-8 remains a blob. */
        }
      }
      const result = {
        contents: [
          {
            uri: params.uri,
            mimeType: artifact.mediaType,
            ...(text === undefined
              ? { blob: bytes.toString("base64") }
              : { text }),
          },
        ],
      };
      if (Buffer.byteLength(JSON.stringify(result)) > maximumBytes - 4096)
        throw new IntloomError(
          "RESULT_TOO_LARGE",
          "Encoded resource exceeds 8 MiB; use intloom_artifact_read or CLI artifact export.",
          { artifactId, runId: artifact.runId },
        );
      return result;
    } catch (error) {
      const projected = publicError(error);
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        projected.message,
        projected,
      );
    }
  });
}
