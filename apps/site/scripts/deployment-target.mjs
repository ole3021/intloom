import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";

export function selectDeploymentTarget(branch, refType = "branch") {
  if (
    refType !== "branch" ||
    !branch ||
    branch.includes("/") ||
    (branch !== "master" && !branch.startsWith("feat-"))
  ) {
    throw new Error("Only master and feat-* branches may deploy the site.");
  }
  if (branch === "master") return { script: "ci:deploy", alias: "" };

  const hash = createHash("sha256").update(branch).digest("hex").slice(0, 10);
  // 预览别名最多 31 个字符，为 Worker 名称保留 31 个字符。
  const slug = branch
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .slice(0, 20)
    .replace(/-+$/, "");
  return { script: "ci:preview", alias: `${slug}-${hash}` };
}

if (import.meta.main) {
  const branch = process.env.GITHUB_REF_NAME;
  const { script, alias } = selectDeploymentTarget(
    branch,
    process.env.GITHUB_REF_TYPE ?? "",
  );

  // 发布前检查分支当前提交，拒绝已经落后的任务。
  const response = await fetch(
    `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/git/ref/heads/${encodeURIComponent(branch)}`,
    {
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${process.env.GH_TOKEN}`,
        Accept: "application/vnd.github+json",
      },
    },
  );
  if (!response.ok)
    throw new Error(`Cannot verify branch head: HTTP ${response.status}.`);
  const ref = await response.json();
  if (ref.object.sha !== process.env.GITHUB_SHA)
    throw new Error(
      "This commit is no longer the branch head; deploy the latest run.",
    );

  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `script=${script}\nalias=${alias}\n`,
  );
}
