import type { CmdContext } from "../context.ts";
import {
  str,
  bool,
  pos,
  instanceFlag,
  admissionFlags,
  invalid,
  value,
  integer,
} from "../arguments.ts";
import { observing } from "../observe.ts";
export function createRunsCommands(context: CmdContext) {
  const { core, pathInputs, print, text, instance, binding, leaf } = context;
  return {
    resume: leaf(
      "Explicitly resume a paused mirror Run",
      {
        runId: pos("Run ID"),
        scope: str("New scope after scope completion"),
        "abandon-mirror": bool(
          "Explicitly stop this Run mirror capture after a failure; requires --scope loom",
        ),
        revision: str("Observed Run revision"),
        ...admissionFlags,
      },
      async (a, input) => {
        const bound = await binding(input, a);
        if (!bound) return;
        const runId = value(a, "runId") ?? "";
        const observed = await core.getRun({ ...bound, runId });
        if (!observed.ok) {
          print(observed);
          return;
        }
        if (!observed.data.revision)
          invalid("Observed Run revision is missing.");
        const scope = value(a, "scope");
        if (scope && !["step", "stage", "loom"].includes(scope))
          invalid("Invalid scope.");
        const revision =
          a.revision === undefined
            ? observed.data.revision
            : integer(a, "revision", Number.MAX_SAFE_INTEGER, 1);
        if (revision === undefined) invalid("Resume revision is missing.");
        print(
          await core.resumeRun({
            ...bound,
            runId,
            expectedRevision: revision,
            ...(a["abandon-mirror"] ? { abandonMirror: true } : {}),
            ...(scope ? { scope: scope as "step" | "stage" | "loom" } : {}),
          }),
        );
      },
    ),
    runs: leaf(
      "Active Runs and retained history",
      {
        loom: str("Loom"),
        "operation-id": str("Originating operation UUID"),
        "origin-instance": str("Originating Service instance UUID"),
        ...instanceFlag,
      },
      async (a, p) => {
        if (a["operation-id"] || a["origin-instance"]) {
          if (a.loom) invalid("Origin lookup cannot combine with --loom.");
          return print(
            await core.findRun({
              ...instance(p, a),
              operationId: value(a, "operation-id", true),
              originatingInstanceId: value(a, "origin-instance", true),
            }),
          );
        }
        print(
          await core.listRuns({
            ...instance(p, a),
            ...(a.loom ? { loomName: value(a, "loom", true) } : {}),
          }),
        );
      },
    ),
    run: leaf(
      "Run a Loom with the supplied inputs",
      {
        loomName: pos("Loom name"),
        prompt: str("Description for the Loom"),
        "prompt-file": str("UTF-8 description file or -"),
        file: str("File path; repeat to provide multiple files"),
        dir: str("Directory path; repeat to provide multiple directories"),
        url: str("URL; repeat to provide multiple URLs"),
        ...admissionFlags,
      },
      async (a, p) => {
        const bound = await binding(p, a);
        if (bound)
          print(
            await core.run({
              ...bound,
              loomName: value(a, "loomName", true),
              input: {
                ...(a.prompt !== undefined || a["prompt-file"] !== undefined
                  ? { prompt: await text(a, "prompt", "prompt-file") }
                  : {}),
                ...pathInputs,
              },
            }),
          );
      },
    ),
    attach: leaf(
      "Inspect an existing Run",
      { runId: pos("Run ID"), ...instanceFlag },
      async (a, p) =>
        print(
          await core.getRun({
            ...instance(p, a),
            runId: value(a, "runId", true),
          }),
        ),
    ),
    answer: leaf(
      "Submit the complete Loom answer JSON",
      {
        runId: pos("Run ID"),
        action: str("Action ID"),
        answer: str("Complete JSON"),
        "answer-file": str("JSON file or -"),
        ...admissionFlags,
      },
      async (a, p) => {
        const bound = await binding(p, a);
        if (!bound) return;
        let answer: import("@intloom/loom-sdk").JsonValue;
        try {
          answer = JSON.parse(await text(a, "answer", "answer-file"));
        } catch {
          invalid("Answer must be complete valid JSON.");
        }
        print(
          await core.answerAsk({
            ...bound,
            runId: value(a, "runId", true),
            actionId: value(a, "action", true),
            answer,
          }),
        );
      },
    ),
    cancel: leaf(
      "Explicitly cancel Run",
      { runId: pos("Run ID"), ...admissionFlags },
      async (a, p) => {
        const bound = await binding(p, a);
        if (!bound) return;
        print(
          await core.cancelRun({ ...bound, runId: value(a, "runId", true) }),
        );
      },
    ),
    pause: leaf(
      "Pause after the active Step settles",
      { runId: pos("Run ID"), ...admissionFlags },
      async (a, p) => {
        const bound = await binding(p, a);
        if (!bound) return;
        print(
          await core.pauseRun({ ...bound, runId: value(a, "runId", true) }),
        );
      },
    ),
    operation: leaf(
      "Inspect admission receipt",
      { operationId: pos("UUID"), ...instanceFlag },
      async (a, p) =>
        print(
          await core.getOperation({
            ...instance(p, a),
            operationId: value(a, "operationId", true),
          }),
        ),
    ),
    wait: leaf(
      "Wait for action or terminal; never answer/cancel",
      {
        runId: pos("Run ID"),
        until: str("action_or_terminal or terminal"),
        timeout: str("Milliseconds"),
        ...instanceFlag,
      },
      async (a, p) => {
        const until = value(a, "until") ?? "action_or_terminal";
        if (!["action_or_terminal", "terminal"].includes(until))
          invalid("Invalid until value.");
        const timeoutMs = integer(a, "timeout", 2147483647, 1);
        const observer = observing();
        try {
          print(
            await core.waitRun(
              {
                ...instance(p, a),
                runId: value(a, "runId", true),
                until: until as "terminal" | "action_or_terminal",
                ...(timeoutMs === undefined ? {} : { timeoutMs }),
              },
              { signal: observer.controller.signal },
            ),
          );
        } finally {
          observer.close();
        }
      },
    ),
    watch: leaf(
      "Observe snapshots; Ctrl+C closes observation",
      { runId: pos("Optional Run ID", false), ...instanceFlag },
      async (a, p) => {
        const observer = observing();
        try {
          const stream = a.runId
            ? core.watchRun(
                { ...instance(p, a), runId: value(a, "runId", true) },
                { signal: observer.controller.signal },
              )
            : core.watchProject(instance(p, a), {
                signal: observer.controller.signal,
              });
          for await (const result of stream) print(result);
        } finally {
          observer.close();
        }
      },
    ),
  };
}
