import { randomBytes } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  appMethods,
  appProtocolVersion,
  appSnapshotSchema,
  appAnswerSchema,
  appOperationSchema,
  type AppBootstrap,
  type AppSnapshot,
} from "@intloom/loom-sdk/app-contracts";
import {
  interactionRequestSchema,
  interactionResponse,
} from "@intloom/loom-sdk";
import type { ProjectOperations } from "./project.ts";
import type { OperationsPorts, AppResource } from "./ports.ts";
import { failure } from "../errors.ts";

interface Grant {
  source: string;
  runId: string;
  resource: AppResource;
  instance: string;
  expires: number;
}
interface Submission {
  owner: string;
  parameters: ReturnType<typeof appAnswerSchema.parse>;
}
const sessions = new WeakMap<
  OperationsPorts,
  { grants: Map<string, Grant>; submissions: Map<string, Submission> }
>();
export type AppOperations = ReturnType<typeof createAppOperations>;

/** Ephemeral view grants; Run state and durable answers stay in Runtime/Storage. */
export function createAppOperations(
  ports: OperationsPorts,
  operations: () => ProjectOperations,
) {
  let state = sessions.get(ports);
  if (!state) {
    state = { grants: new Map(), submissions: new Map() };
    sessions.set(ports, state);
  }
  const { grants, submissions } = state;
  const resources = () => ports.appResources?.() ?? Promise.resolve([]);
  const owner = (grant: Grant) =>
    JSON.stringify([
      grant.source,
      grant.runId,
      grant.resource.loomIdentity,
      grant.resource.appId,
    ]);
  async function grantFor(token: string) {
    ports.assertOpen();
    const grant = grants.get(token);
    if (
      !grant ||
      grant.expires <= Date.now() ||
      grant.source !== operations().source
    )
      throw failure("APP_VIEW_EXPIRED", "Reopen the App for this Run");
    if ((await operations().status()).instanceId !== grant.instance)
      throw failure(
        "SERVICE_INSTANCE_CHANGED",
        "Reopen the App after a service restart",
      );
    return grant;
  }
  async function project(grant: Grant): Promise<AppSnapshot> {
    const run = await operations().getRun(grant.runId);
    if (run.loomIdentity !== grant.resource.loomIdentity)
      throw failure(
        "APP_RESOURCE_UNAVAILABLE",
        "The Run requires a different Loom artifact",
      );
    const { definition, appId } = grant.resource;
    let view: AppSnapshot["view"];
    if (run.status === "completed" || run.status === "failed") {
      if (definition.presentation?.result.app !== appId)
        view = { mode: "status", reason: "terminal" };
      else if (run.status === "completed" && run.output !== undefined)
        view = {
          mode: "result",
          outcome: "completed",
          output: structuredClone(
            run.output,
          ) as import("@intloom/loom-sdk").JsonValue,
        };
      else
        view = {
          mode: "result",
          outcome: "failed",
          ...(run.lastError ? { error: run.lastError } : {}),
          ...(run.stopReason ? { stopReason: run.stopReason } : {}),
          evidenceRefs: run.results
            ? JSON.parse(JSON.stringify(run.results))
            : [],
        };
    } else if (run.pendingAction?.kind === "user_ask_interaction") {
      const {
        interactionId,
        definition: interaction,
        context,
      } = interactionRequestSchema.parse(run.pendingAction.request);
      view =
        interaction.app !== appId
          ? { mode: "status", reason: "handoff" }
          : {
              mode: "interaction",
              action: {
                actionId: run.pendingAction.id,
                interactionId,
                kind: interaction.kind,
                title: interaction.title,
                ...(interaction.description
                  ? { description: interaction.description }
                  : {}),
                context,
                contextSchema: interaction.context,
                responseSchema: interactionResponse(interaction),
                ...(interaction.kind === "select" && interaction.presentation
                  ? { presentation: interaction.presentation }
                  : {}),
              },
            };
    } else
      view = {
        mode: "status",
        reason: run.pendingAction
          ? "handoff"
          : run.pendingAgentCall
            ? "agent_pending"
            : run.status === "paused"
              ? "paused"
              : "running",
      };
    return appSnapshotSchema.parse({
      appId,
      run: {
        runId: run.runId,
        loomName: run.loomName,
        loomVersion: definition.version,
        loomIdentity: grant.resource.loomIdentity,
        serviceInstanceId: run.serviceInstanceId,
        revision: run.revision,
        status: run.status,
        settled: run.settled === true,
      },
      view,
    });
  }
  const describe = (resource: AppResource) => ({
    appId: resource.appId,
    loomName: resource.loomName,
    loomIdentity: resource.loomIdentity,
    resourceUri: resource.uri,
    toolName: resource.toolName,
    mimeType: resource.descriptor.mimeType,
  });
  return {
    resources,
    async presentation(runId: string) {
      const run = await operations().getRun(runId);
      const available = (await resources()).filter(
        (item) =>
          item.loomName === run.loomName &&
          item.loomIdentity === run.loomIdentity,
      );
      const pending =
        run.pendingAction?.kind === "user_ask_interaction"
          ? interactionRequestSchema.parse(run.pendingAction.request).definition
              .app
          : undefined;
      const id = ["completed", "failed"].includes(run.status)
        ? available[0]?.definition.presentation?.result.app
        : pending;
      const resource = available.find((item) => item.appId === id);
      return resource ? describe(resource) : null;
    },
    async open(
      runId: string,
      appId: string,
      loomName?: string,
    ): Promise<AppBootstrap> {
      ports.assertOpen();
      const run = await operations().getRun(runId);
      const resource = (await resources()).find(
        (item) =>
          item.appId === appId &&
          item.loomName === run.loomName &&
          (!loomName || item.loomName === loomName) &&
          item.loomIdentity === run.loomIdentity,
      );
      if (!resource)
        throw failure(
          "APP_RESOURCE_UNAVAILABLE",
          "No matching App exists for this Run artifact",
        );
      await resource.readHtml();
      for (const [token, grant] of grants)
        if (grant.expires <= Date.now()) grants.delete(token);
      if (grants.size >= 1024) throw failure("BUSY", "Too many open App views");
      const grant: Grant = {
        source: operations().source,
        runId,
        resource,
        instance: (await operations().status()).instanceId,
        expires: Date.now() + 3600_000,
      };
      const snapshot = await project(grant);
      const viewToken = randomBytes(32).toString("base64url");
      grants.set(viewToken, grant);
      return {
        protocolVersion: appProtocolVersion,
        viewToken,
        expiresAt: new Date(grant.expires).toISOString(),
        methods: appMethods,
        snapshot,
      };
    },
    async read(viewToken: string) {
      return project(await grantFor(viewToken));
    },
    async answer(input: unknown) {
      const request = appAnswerSchema.parse(input);
      const grant = await grantFor(request.viewToken);
      if (request.serviceInstanceId !== grant.instance)
        throw failure(
          "SERVICE_INSTANCE_CHANGED",
          "Submission belongs to another service instance",
        );
      const key = `${request.serviceInstanceId}/${request.operationId}`;
      const existing = submissions.get(key);
      const parameters = { ...request, viewToken: "" };
      if (existing) {
        if (
          existing.owner !== owner(grant) ||
          !isDeepStrictEqual(existing.parameters, parameters)
        )
          throw failure(
            "CONFLICT",
            "Operation identity was reused with different parameters",
          );
      } else {
        const snapshot = await project(grant);
        if (
          snapshot.view.mode !== "interaction" ||
          snapshot.view.action.actionId !== request.actionId
        )
          throw failure("CONFLICT", "This App does not own the current action");
        const raced = submissions.get(key);
        if (
          raced &&
          (raced.owner !== owner(grant) ||
            !isDeepStrictEqual(raced.parameters, parameters))
        )
          throw failure(
            "CONFLICT",
            "Operation identity was reused concurrently",
          );
        if (submissions.size >= 10000)
          throw failure("BUSY", "App submission capacity reached");
        submissions.set(key, { owner: owner(grant), parameters });
      }
      const admitted = await operations().admit(
        "answer",
        {
          serviceInstanceId: request.serviceInstanceId,
          operationId: request.operationId,
          actionId: request.actionId,
          answer: request.answer,
        },
        grant.runId,
      );
      const snapshot = await project(grant).catch(() => undefined);
      return { receipt: admitted.receipt, ...(snapshot ? { snapshot } : {}) };
    },
    async operation(input: unknown) {
      const request = appOperationSchema.parse(input);
      const grant = await grantFor(request.viewToken);
      if (request.serviceInstanceId !== grant.instance)
        return {
          status: "instance_changed" as const,
          serviceInstanceId: grant.instance,
        };
      const saved = submissions.get(
        `${request.serviceInstanceId}/${request.operationId}`,
      );
      if (!saved || saved.owner !== owner(grant))
        throw failure(
          "CAPABILITY_DENIED",
          "This operation does not belong to the App view",
        );
      return operations().getOperation(
        request.serviceInstanceId,
        request.operationId,
      );
    },
  };
}
