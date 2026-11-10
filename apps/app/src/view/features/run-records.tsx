import { Button } from "@/components/ui/button";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Facts, when, duration } from "@/components/common";
import { navigate } from "@/lib/studio";

import type { RunDetail as Detail, RunEvent } from "../../shared/types";

const formatEvent = (e: RunEvent) => {
  switch (e.type) {
    case "log":
      return e.details.message;
    case "interaction.requested":
      return "发起用户交互";
    case "interaction.responded":
      return `保存回应 · ${e.details.source.kind}`;
    case "model.invocation.started":
      return `${e.details.provider} / ${e.details.model}`;
    case "model.step.finished":
      return (
        "用量回执 · " +
        (e.details.inputTokens ?? "未知") +
        " 输入 / " +
        (e.details.outputTokens ?? "未知") +
        " 输出"
      );
    default:
      return e.type;
  }
};
export function RunRecords({ run, wait }: { run: Detail; wait: number }) {
  const { activity, children: kids } = run,
    usage = activity.usage;
  const details = (id: string, label: string, content: React.ReactNode) => (
    <AccordionItem value={id}>
      <AccordionTrigger>{label}</AccordionTrigger>
      <AccordionContent>{content}</AccordionContent>
    </AccordionItem>
  );
  return (
    <Accordion type="multiple">
      {details(
        "events",
        `执行记录 · ${run.events.length}`,
        <ol className="space-y-2">
          {run.events.map((e) => (
            <li key={e.seq} className="flex gap-4 text-sm">
              <time className="font-mono text-xs text-muted-foreground">
                {when(e.time)}
              </time>
              <span>{formatEvent(e)}</span>
            </li>
          ))}
        </ol>,
      )}
      {details(
        "config",
        "输入与运行配置",
        <div className="grid gap-5 md:grid-cols-2">
          <Facts
            items={
              run.binding && run.launch
                ? [
                    ["项目目录", run.launch.projectDir || "未指定"],
                    [
                      "生效方案",
                      `${run.binding.profile} · ${run.binding.source}`,
                    ],
                    [
                      "绑定执行器",
                      `${run.binding.harness} / ${run.binding.adapter}`,
                    ],
                    [
                      "策划绑定",
                      run.binding.planner.model +
                        " · " +
                        run.binding.planner.credentialRef,
                    ],
                    [
                      "校对绑定",
                      run.binding.reviewer.model +
                        " · " +
                        run.binding.reviewer.credentialRef,
                    ],
                    [
                      "业务输入",
                      <pre key="input" className="whitespace-pre-wrap text-xs">
                        {JSON.stringify(run.launch.input, null, 2)}
                      </pre>,
                    ],
                  ]
                : [
                    ["业务目录", run.summary.location.directory ?? "未指定"],
                    ["执行器", run.summary.harness ?? "—"],
                  ]
            }
          />
          <div>
            <h3 className="mb-2 font-medium">实际调用回执</h3>
            {activity.recentExecutions.length
              ? activity.recentExecutions.map((e) => (
                  <div key={e.id}>
                    {e.status} · {e.model?.slot} · {e.model?.provider} /{" "}
                    {e.model?.model}
                  </div>
                ))
              : "暂无调用回执"}
          </div>
        </div>,
      )}
      {details(
        "usage",
        "用量与耗时",
        <Facts
          items={[
            [
              "输入 Token",
              usage.inputTokens.receipts ? usage.inputTokens.reported : "未知",
            ],
            [
              "输出 Token",
              usage.outputTokens.receipts
                ? usage.outputTokens.reported
                : "未知",
            ],
            ["等待时间", duration(wait)],
            [
              "费用",
              Object.entries(usage.costs)
                .map(([currency, c]) => `${currency} ${c.reported}`)
                .join("、") || "未报告",
            ],
          ]}
        />,
      )}
      {!!kids.length &&
        details(
          "children",
          `子 Run · ${kids.length}`,
          kids.map((x) => (
            <Button
              key={x.summary.id}
              variant="link"
              onClick={() => navigate(`/run/${x.summary.id}`)}
            >
              {x.title} · {x.statusLabel}
            </Button>
          )),
        )}
      {run.acceptance &&
        details(
          "acceptance",
          "验收记录",
          <>
            <p>
              {run.acceptance.status} · {run.acceptance.id}
            </p>
            {run.acceptance.result.checks?.map((c) => (
              <p key={c.criterionId}>
                {c.criterionId} · {c.status} {c.message}
              </p>
            ))}
          </>,
        )}
      {!!run.answers.length &&
        details(
          "answers",
          "已保存的回应",
          run.answers.map((a) => (
            <div key={a.id} className="py-1">
              {a.source.kind} ·{" "}
              {JSON.stringify(a.action === "submit" ? a.value : a.action)} ·{" "}
              {when(a.receivedAt)}
            </div>
          )),
        )}
    </Accordion>
  );
}
