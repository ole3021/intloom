import { useState, useEffect } from "react";

import { Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  CardDescription,
} from "@/components/ui/card";

import { useStudio } from "@/lib/studio";

import type { RunDetail as Detail } from "../../shared/types";

export function Review({
  request,
  title,
  candidate,
}: Detail["reviews"][number]) {
  const { perform, state, api, show } = useStudio(),
    [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const focusRequest = () => {
      if (
        new URLSearchParams(location.hash.split("?")[1]).get("request") ===
        request.id
      )
        document
          .getElementById(request.id)
          ?.scrollIntoView({ block: "center" });
    };
    focusRequest();
    window.addEventListener("hashchange", focusRequest);
    return () => window.removeEventListener("hashchange", focusRequest);
  }, [request.id]);
  async function respond(value: string | boolean) {
    if (busy) return;
    setBusy(true);
    const result = await perform({
      type: "answer",
      requestId: request.id,
      value,
    });
    const continuation = result?.interaction?.continuation;
    if (continuation?.status === "needs_attention") show(continuation.message);
    setBusy(false);
  }
  return (
    <Card
      id={request.id}
      className="new-event border-amber-300/60 dark:border-amber-800/60"
    >
      <CardHeader>
        <CardDescription>
          {request.kind === "approval" ? "需要本人确认" : "需要补充信息"} ·{" "}
          {title} · {request.runId}
        </CardDescription>
        <CardTitle>{request.message}</CardTitle>
      </CardHeader>
      <CardContent>
        {request.kind === "ask" && !state.mock && (
          <>
            {request.context !== undefined && (
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(request.context, null, 2)}
              </pre>
            )}
            {request.answerSchema.type !== "string" && (
              <pre className="whitespace-pre-wrap text-xs">
                {JSON.stringify(request.answerSchema, null, 2)}
              </pre>
            )}
          </>
        )}
        {request.kind === "ask" ? (
          <Textarea
            data-update-draft={text ? "回答" : undefined}
            aria-label="回答内容"
            placeholder={
              !state.mock && request.answerSchema.type !== "string"
                ? "按请求格式填写 JSON"
                : "填写回答"
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        ) : candidate ? (
          <Button
            variant="outline"
            onClick={() =>
              void api
                .artifact(candidate.id, "open")
                .catch((e) => show(String(e)))
            }
          >
            <ExternalLink />
            {candidate.name} · v1
          </Button>
        ) : (
          <ol className="list-inside list-decimal space-y-2 text-sm">
            {(Array.isArray(request.context)
              ? request.context.map(String)
              : [
                  typeof request.context === "object"
                    ? JSON.stringify(request.context, null, 2)
                    : String(request.context ?? request.message),
                ]
            ).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        {request.kind === "approval" ? (
          <>
            <Button
              disabled={busy || state.service !== "online"}
              onClick={() => void respond(true)}
            >
              <Check />
              {candidate ? "确认交付" : "同意并继续"}
            </Button>
            <Button
              variant="outline"
              disabled={busy || state.service !== "online"}
              onClick={() => void respond(false)}
            >
              拒绝这一版
            </Button>
          </>
        ) : (
          <Button
            disabled={!text.trim() || busy || state.service !== "online"}
            onClick={() => void respond(text.trim())}
          >
            提交回答并继续
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
