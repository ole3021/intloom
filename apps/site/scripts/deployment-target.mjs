import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";

/** @param {string | undefined} branch @param {string} [refType] */
export function selectDeploymentTarget(branch, refType = "branch") {
  if (
    refType !== "branch" ||
    !branch ||
    branch.includes("/") ||
    (branch !== "main" && !branch.startsWith("feat-"))
  ) {
    throw new Error("Only main and feat-* branches may deploy the site.");
  }
  if (branch === "main") return { script: "ci:deploy", alias: "" };

  const hash = createHash("sha256").update(branch).digest("hex").slice(0, 10);
  // Preview aliases use at most 31 characters, leaving 31 characters for the Worker name.
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

  // Check the branch's current commit before deployment and reject outdated jobs.
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
