import { useState } from "react";

import { Download, ExternalLink, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import {
  Card,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription,
} from "@/components/ui/card";

import { useStudio } from "@/lib/studio";

import type { RunDetail as Detail } from "../../shared/types";

export function RunArtifact({ run }: { run: Detail }) {
  const { api } = useStudio(),
    [fileMessage, setFileMessage] = useState("");

  async function file(id: string, mode: "open" | "export") {
    try {
      const path = await api.artifact(id, mode);
      if (path)
        setFileMessage((mode === "open" ? "已打开 " : "已导出 ") + path);
    } catch (e) {
      setFileMessage(String(e));
    }
  }
  return (
    <>
      {run.summary.deliveryStatus === "rejected" && (
        <p>最终交付已拒绝，以下保留原候选文件。</p>
      )}
      {run.files
        ?.filter(
          ({ record }) =>
            !run.reviews.some((r) => r.candidate?.id === record.id),
        )
        .map(({ record, delivered }) => (
          <Card className="new-event" key={record.id}>
            <CardHeader>
              <CardDescription>
                {delivered ? "正式交付" : "候选文件"} · {record.mediaType}
              </CardDescription>
              <CardTitle className="flex items-center gap-2">
                <FileCheck2 className="size-5" />
                {record.name}
              </CardTitle>
              <CardDescription>
                {record.size} B · SHA-256 {record.digest.slice(0, 12)}
              </CardDescription>
            </CardHeader>
            <CardFooter className="gap-2">
              <Button onClick={() => void file(record.id, "open")}>
                <ExternalLink />
                打开文件
              </Button>
              <Button
                variant="outline"
                onClick={() => void file(record.id, "export")}
              >
                <Download />
                导出到…
              </Button>
            </CardFooter>
          </Card>
        ))}
      {run.output !== undefined && !run.files?.length && (
        <pre className="whitespace-pre-wrap">
          {JSON.stringify(run.output, null, 2)}
        </pre>
      )}
      {run.artifactIssue && <p role="alert">{run.artifactIssue}</p>}{" "}
      {fileMessage && (
        <p role="status" className="break-all text-xs">
          {fileMessage}
        </p>
      )}
    </>
  );
}
