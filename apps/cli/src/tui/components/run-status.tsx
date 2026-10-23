import { For, Show, type Accessor } from "solid-js";
import type { ServiceRunView } from "../../core/index.ts";
import { displayStatus } from "./widgets.tsx";

export function RunStatus(props: { run: ServiceRunView }) {
  const metrics = () => props.run.metrics;
  const duration = (value: number) => `${Math.round(value / 1000)}s`;
  return (
    <>
      <text flexShrink={0}>{displayStatus(props.run)}</text>
      <text
        flexShrink={0}
      >{`${props.run.cursor.stageName}/${props.run.cursor.stepName}`}</text>
      <For each={props.run.activity}>
        {(item) => (
          <text
            flexShrink={0}
          >{`${item.kind}${item.agentId ? ` · ${item.agentId}` : ""}`}</text>
        )}
      </For>
      <Show
        when={metrics()}
        fallback={<text flexShrink={0}>Statistics unavailable</text>}
      >
        {(value: Accessor<NonNullable<ServiceRunView["metrics"]>>) => (
          <text
            flexShrink={0}
          >{`Execution ${duration(value().timing.executionMs)}\nHuman wait ${duration(value().timing.humanWaitMs)}\nModel calls ${value().calls.modelRequests}\nTools ${value().calls.tools}\nInput tokens ${value().usage.inputTokens ?? "unknown"}\nOutput tokens ${value().usage.outputTokens ?? "unknown"}\nUsage ${value().usage.completeness}\nEstimated USD ${value().cost.knownAmount ?? "unknown"}\nCost ${value().cost.completeness}\nResults ${(props.run.results ?? []).length}\nSettled ${props.run.settled}\n${value().recovered ? "Recovered in this instance" : "Current Service instance"}`}</text>
        )}
      </Show>
      <For each={Object.entries(props.run.limits ?? {})}>
        {([name, value]) => <text flexShrink={0}>{`${name}: ${value}`}</text>}
      </For>
      <text
        flexShrink={0}
        fg="#9299a5"
      >{`Instance ${props.run.serviceInstanceId}`}</text>
    </>
  );
}
