import { runFacts } from "./run-facts.ts";
import { generateId } from "@intloom/utils";
import type {
  CallScope,
  CapabilityKind,
  CapabilityUse,
} from "../access/contracts.ts";
import { sampleRunObservation } from "./run-observation.ts";
import { ERRORS } from "../errors.ts";
import type { RunEntry } from "./run-entry.ts";

/** Only Runtime can close/revoke a call; Access receives the narrow scope. */
export class RuntimeCall extends AbortController implements CallScope {
  readonly runId: string;
  readonly callId = generateId("CALL");
  readonly entry: RunEntry;
  readonly closedAndSettled: Promise<void>;
  private settled!: () => void;
  private uses = 0;
  private closing = false;
  constructor(entry: RunEntry) {
    super();
    this.entry = entry;
    this.runId = entry.state.id;
    this.closedAndSettled = new Promise((resolve) => {
      this.settled = resolve;
    });
    this.signal.addEventListener(
      "abort",
      () => {
        if (!this.uses) this.settled();
      },
      { once: true },
    );
  }
  assertCurrent(): void {
    assertCallOwnership(this.entry, this);
    this.signal.throwIfAborted();
    if (this.closing) throw ERRORS.create("EXECUTION_OWNERSHIP_LOST");
  }
  beginUse(kind: CapabilityKind): CapabilityUse {
    this.assertCurrent();
    if (
      this.entry.state.status === "waiting" &&
      !this.entry.state.pendingAgentCall
    )
      throw ERRORS.create("CAPABILITY_DENIED");
    if (
      kind === "interaction" &&
      this.uses &&
      !(
        this.entry.blueprint.capability &&
        this.entry.state.pendingAgentCall &&
        this.uses === 1
      )
    )
      throw ERRORS.create("CALL_UNSETTLED");
    if (
      (kind === "storage_commit" ||
        (kind === "interaction" &&
          !(
            this.entry.blueprint.capability && this.entry.state.pendingAgentCall
          ))) &&
      this.entry.state.status !== "running"
    )
      throw ERRORS.create("CAPABILITY_DENIED");
    this.uses++;
    const facts = runFacts(this.entry.state);
    facts.inFlight++;
    let finished = false;
    return {
      assertCurrent: () => {
        if (finished) throw ERRORS.create("EXECUTION_OWNERSHIP_LOST");
        this.assertCurrent();
        if (
          kind !== "interaction" &&
          this.entry.state.status === "waiting" &&
          !this.entry.state.pendingAgentCall
        )
          throw ERRORS.create("CAPABILITY_DENIED");
      },
      finish: () => {
        if (finished) return;
        finished = true;
        this.uses--;
        if (!this.uses && this.signal.aborted) this.settled();
        facts.inFlight--;
        sampleRunObservation(this.entry.state);
      },
    };
  }
  trackActivity(): () => void {
    this.assertCurrent();
    this.uses++;
    const facts = runFacts(this.entry.state);
    facts.inFlight++;
    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      this.uses--;
      facts.inFlight--;
      if (!this.uses && this.signal.aborted) this.settled();
      sampleRunObservation(this.entry.state);
    };
  }
  assertSettled(): void {
    if (this.uses) throw ERRORS.create("CALL_UNSETTLED");
  }
  close(): void {
    this.closing = true;
  }
}

export function ownsCall(entry: RunEntry, call: object): boolean {
  return (
    entry.activeCall === call &&
    (entry.state.status === "running" || entry.state.status === "waiting")
  );
}

export function assertCallOwnership(entry: RunEntry, call: object): void {
  if (!ownsCall(entry, call)) throw ERRORS.create("EXECUTION_OWNERSHIP_LOST");
}

export function beginCall(entry: RunEntry): RuntimeCall {
  if (entry.activeCall) throw ERRORS.create("RUN_STATE_INVALID");
  const call = new RuntimeCall(entry);
  entry.activeCall = call;
  return call;
}

export function endCall(entry: RunEntry, call: object): void {
  if (entry.activeCall !== call) {
    if (call instanceof AbortController)
      call.abort(ERRORS.create("EXECUTION_OWNERSHIP_LOST"));
    return;
  }
  if (call instanceof RuntimeCall) call.close();
  delete entry.activeCall;

  const reply = entry.reply;
  delete entry.reply;
  reply?.reject(ERRORS.create("EXECUTION_OWNERSHIP_LOST"));
  if (call instanceof AbortController)
    call.abort(ERRORS.create("EXECUTION_OWNERSHIP_LOST"));
}
