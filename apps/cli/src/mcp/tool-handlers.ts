import {
  IntloomError,
  type ArtifactRecord,
  type InteractionResponse,
} from "@intloom/loom-sdk";
import {
  type Server,
  ProtocolError,
  ProtocolErrorCode,
  type inputRequired,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  maximumBytes,
  publicError,
  type ServiceClient,
  type ClientMethods,
} from "../service/protocol.ts";
import { tools } from "./tools.ts";
import { resourceUri } from "./resources.ts";
import type { interactionPresenter } from "./interactions.ts";

export function registerTools(
  server: Server,
  defaultClient: ServiceClient,
  prompt: ReturnType<typeof interactionPresenter>["prompt"],
  logMessage?: (message: string) => void,
  clientFor?: (directory?: string) => ServiceClient,
) {
  server.setRequestHandler("tools/list", async () => ({
    tools: tools.map(([name, description, schema, method]) => ({
      name,
      description,
      inputSchema: {
        ...z.toJSONSchema(schema),
        ...(method === "resumeRun"
          ? {
              oneOf: [
                {
                  required: ["requestId"],
                  not: {
                    anyOf: [
                      { required: ["waitId"] },
                      { required: ["resumeData"] },
                    ],
                  },
                },
                { required: ["waitId"], not: { required: ["requestId"] } },
              ],
            }
          : {}),
      } as { type: "object" },
    })),
  }));
  server.setRequestHandler("tools/call", async ({ params }, ctx) => {
    const tool = tools.find(([name]) => name === params.name);
    if (!tool) {
      logMessage?.("Unknown tool · InvalidParams");
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        "Unknown Intloom tool.",
      );
    }
    const parsed = tool[2].safeParse(params.arguments ?? {});
    if (!parsed.success) {
      logMessage?.(`${tool[0]} · Invalid arguments`);
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        "Invalid tool arguments.",
      );
    }
    const started = Date.now();
    const { directory, ...args } = parsed.data as Record<string, unknown>;
    const client =
      clientFor?.(directory as string | undefined) ?? defaultClient;
    const log = (state: string, runId?: unknown) =>
      logMessage?.(
        [
          `${tool[0]}  ${state}`,
          typeof runId === "string" && /^[a-z0-9_-]{1,100}$/i.test(runId)
            ? runId
            : undefined,
          `${Date.now() - started} ms`,
        ]
          .filter(Boolean)
          .join(" · "),
      );
    if (!/^(get|list|read)/.test(tool[3])) log("Started", args.runId);
    try {
      let data: unknown;
      const method = tool[3];
      if (method === "prompt") {
        data = await prompt(args.requestId as string, ctx);
        if (
          data &&
          typeof data === "object" &&
          "resultType" in data &&
          data.resultType === "input_required"
        ) {
          log("Awaiting client response");
          return data as ReturnType<typeof inputRequired>;
        }
      } else if (method === "respondInteraction")
        data = await client(method, [
          args.requestId as string,
          args.response as InteractionResponse,
          { source: { kind: "agent", via: "mcp" } },
        ]);
      else if (method === "cancelRun")
        data = await client(method, [
          args.runId as string,
          args.reason as string | undefined,
        ]);
      else if (method === "getLoom")
        data = await client(method, [
          args.loom as import("@intloom/loom-sdk").LoomSelector,
        ]);
      else if (
        method === "startRun" ||
        method === "getRun" ||
        method === "getRunResult" ||
        method === "getRunActivity"
      )
        data = await client(method, [args.runId as string]);
      else if (method === "getInteraction")
        data = await client(method, [args.requestId as string]);
      else if (method === "getArtifact") {
        const artifact = (await client(method, [
          args.artifactId as string,
        ])) as ArtifactRecord;
        data = { ...artifact, uri: resourceUri(artifact.id) };
      } else if (method === "getAcceptance")
        data = await client(method, [args.acceptanceId as string]);
      else if (method === "listInteractions")
        data = {
          items: await client(method, [args] as Parameters<
            ClientMethods[typeof method]
          >),
        };
      else if (method === "createRun") {
        const loom =
          typeof args.loom === "string"
            ? (
                await client("getLoom", [
                  {
                    id: args.loom,
                    ...(typeof args.command === "string"
                      ? { command: args.command }
                      : {}),
                  },
                ])
              ).ref
            : (args.loom as import("@intloom/loom-sdk").InstalledLoomRef);
        data = await client(method, [
          {
            loom,
            input: args.input,
            ...(args.confirmDelivery === true ? { confirmDelivery: true } : {}),
          },
        ]);
      } else
        data = await client(method, [args] as Parameters<
          ClientMethods[typeof method]
        >);
      const structuredContent = { ok: true, data };
      if (
        Buffer.byteLength(JSON.stringify(structuredContent)) >
        maximumBytes - 4096
      )
        throw new IntloomError(
          "RESULT_TOO_LARGE",
          "Result exceeds 8 MiB; use paginated queries, intloom_artifact_read or CLI artifact export.",
        );
      const res = data as
        | {
            id?: string;
            runId?: string;
            status?: string;
            runStatus?: string;
            disposition?: string;
            run?: { id?: string };
          }
        | undefined;
      const state =
        method === "getRun"
          ? res?.status
          : method === "getRunResult"
            ? res?.runStatus
            : res?.disposition;
      log(
        state ? `Completed · ${state}` : "Completed",
        args.runId ??
          res?.runId ??
          res?.run?.id ??
          (method === "createRun" ? res?.id : undefined),
      );
      return {
        structuredContent,
        content: [
          {
            type: "text",
            text: `${params.name} succeeded. Complete data is in structuredContent.`,
          },
        ],
      };
    } catch (error) {
      let projected = publicError(error);
      log(projected.code, args.runId);
      if (projected.code === "RESULT_TOO_LARGE")
        projected = {
          ...projected,
          details: {
            ...(typeof args.runId === "string" ? { runId: args.runId } : {}),
            ...(typeof args.artifactId === "string"
              ? { artifactId: args.artifactId }
              : {}),
          },
        };
      return {
        isError: true,
        structuredContent: { ok: false, error: projected },
        content: [
          { type: "text", text: `${projected.code}: ${projected.message}` },
        ],
      };
    }
  });
}
