import type { StageAccess } from "./access.ts";
import { project } from "./access.ts";
import { digest, json } from "./json.ts";
import { fail } from "./errors.ts";
import {
  baseStateSchema,
  type BaseState,
  type Candidate,
  type Evidence,
} from "./schema/common.ts";
import {
  executionDataSchema,
  type VerificationEntry,
} from "./schema/verification.ts";
import { save } from "./state.ts";
export function candidate(files: Readonly<Record<string, string>>): Candidate {
  const hash = digest(files);
  return { id: `CAND-${hash}`, digest: hash, files: { ...files } };
}
export async function snapshot(access: StageAccess) {
  return candidate(await project(access).snapshot());
}
export async function assertCandidate(
  access: StageAccess,
  expected: Candidate,
) {
  if (
    digest(expected.files) !== expected.digest ||
    expected.id !== `CAND-${expected.digest}` ||
    (await snapshot(access)).digest !== expected.digest
  )
    fail(
      "The project differs from the fixed candidate. Start a new Run for product changes.",
      "INTENT_CANDIDATE_CHANGED",
    );
}
export function evidence(
  state: BaseState,
  kind: Evidence["kind"],
  data: unknown,
  candidateRef?: string,
) {
  const body = {
    kind,
    data: json(data),
    runId: state.id,
    stageName: state.stageName,
    ...(candidateRef ? { candidateRef } : {}),
  };
  const value: Evidence = { id: `EVD-${digest(body)}`, ...body };
  if (!state.evidence.some((item) => item.id === value.id))
    state.evidence.push(value);
  return value;
}
export function getEvidence(state: BaseState, ref: string) {
  const item = state.evidence.find((item) => item.id === ref);
  if (!item) fail(`Unknown evidence: ${ref}`);
  return item;
}
export function evidenceView(items: Evidence[]) {
  return items.map(({ data, ...item }) => {
    const execution = executionDataSchema.safeParse(data);
    return {
      ...item,
      summary: execution.success
        ? {
            verificationRef: execution.data.verificationRef,
            outcome: execution.data.outcome,
            exitCode: execution.data.result.exitCode,
            truncated: execution.data.result.truncated,
            timedOut: execution.data.result.timedOut,
          }
        : data && typeof data === "object" && !Array.isArray(data)
          ? {
              path: data.path,
              recordRef: data.recordRef,
              verificationRef: data.verificationRef,
            }
          : {},
    };
  });
}
export function context(state: BaseState) {
  return {
    runId: state.id,
    prompt: state.prompt,
    revision: state.revision,
    task: state.task,
    feedback: state.feedback,
    interactions: state.interactions,
    evidence: evidenceView(state.evidence),
    capabilities: {
      projectRead: true,
      projectWrite:
        state.stageName === "implementation" && state.task === "implement",
      browser: false,
      userInteraction: "code",
    },
  };
}
export function rawState(access: StageAccess) {
  return baseStateSchema.passthrough().parse(access.state.value);
}
export function changes(
  baseline: Candidate,
  current: Candidate,
  sources: Evidence[],
) {
  return [
    ...new Set([...Object.keys(baseline.files), ...Object.keys(current.files)]),
  ]
    .sort()
    .filter((path) => baseline.files[path] !== current.files[path])
    .map((path) => ({
      id: `CHG-${digest({ candidate: current.id, path }).slice(0, 24)}`,
      candidateRef: current.id,
      path,
      kind: !baseline.files[path]
        ? ("add" as const)
        : !current.files[path]
          ? ("remove" as const)
          : ("modify" as const),
      beforeDigest: baseline.files[path] ?? null,
      afterDigest: current.files[path] ?? null,
      operationRefs: sources
        .filter(
          (item) =>
            item.kind === "project_write" &&
            item.data &&
            typeof item.data === "object" &&
            !Array.isArray(item.data) &&
            item.data.path === path,
        )
        .map((item) => item.id),
    }));
}
export function linkedEvidence(
  state: BaseState,
  refs: string[],
  candidateRef?: string,
) {
  return refs.map((ref) => {
    const item = getEvidence(state, ref);
    if (candidateRef && item.candidateRef && item.candidateRef !== candidateRef)
      fail(`Evidence belongs to another candidate: ${ref}`);
    return item;
  });
}
export async function verifyEntry(
  access: StageAccess,
  state: BaseState,
  entry: VerificationEntry,
  expected: Candidate,
) {
  await assertCandidate(access, expected);
  if (entry.definition.method.kind !== "command")
    fail("Procedure verification requires observation.");
  const { kind: _kind, ...command } = entry.definition.method;
  entry.disposition = "executing";
  entry.attempts++;
  entry.candidateRef = expected.id;
  entry.reason =
    "Host execution was requested; no settled receipt exists yet. Do not automatically replay.";
  await save(access, state);
  const startedAt = new Date().toISOString();
  const result = await project(access).run(
    {
      command: command.command,
      args: command.args,
      ...(command.cwd ? { cwd: command.cwd } : {}),
      ...(command.timeoutMs ? { timeoutMs: command.timeoutMs } : {}),
    },
    access.signal,
  );
  const after = await snapshot(access);
  const receipt = evidence(
    state,
    "execution",
    executionDataSchema.parse({
      verificationRef: entry.definition.id,
      origin: "verification",
      startedAt,
      finishedAt: new Date().toISOString(),
      before: expected,
      after,
      outcome: [126, 127].includes(result.exitCode ?? 0)
        ? "not_started"
        : result.timedOut || result.exitCode === null
          ? "interrupted"
          : "exited",
      result,
    }),
    expected.id,
  );
  entry.evidenceRefs.push(receipt.id);
  entry.candidateRef = expected.id;
  entry.disposition =
    [126, 127].includes(result.exitCode ?? 0) ||
    result.timedOut ||
    result.exitCode === null
      ? "unavailable"
      : "executed";
  entry.reason =
    entry.disposition === "unavailable"
      ? "Execution could not complete; see the actual receipt."
      : "Host execution settled; exit status is evidence, not an acceptance verdict.";
  await save(access, state);
  await assertCandidate(access, expected);
}
