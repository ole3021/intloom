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
  if (branch === "main") return { script: "deploy:production", alias: "" };

  const hash = createHash("sha256").update(branch).digest("hex").slice(0, 10);
  // Preview aliases use at most 31 characters, leaving 31 characters for the Worker name.
  const slug = branch
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .slice(0, 20)
    .replace(/-+$/, "");
  return { script: "deploy:preview", alias: `${slug}-${hash}` };
}

export async function checkDeployment(
  { branch, refType, commit, repository, ciRunId = "" },
  request,
) {
  const target = selectDeploymentTarget(branch, refType);
  if (!/^[a-f0-9]{40}$/.test(commit ?? ""))
    throw new Error("Deployment requires an exact commit SHA.");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? ""))
    throw new Error("Deployment requires a GitHub repository.");

  if (branch === "main") {
    if (ciRunId && !/^\d+$/.test(ciRunId))
      throw new Error("Invalid CI run ID.");
    const runs = ciRunId
      ? [await request(`/actions/runs/${ciRunId}`)]
      : (
          await request(
            `/actions/workflows/ci.yml/runs?branch=main&head_sha=${commit}&status=success&per_page=100`,
          )
        ).workflow_runs;
    const verified = runs?.some(
      (run) =>
        run.path === ".github/workflows/ci.yml" &&
        run.repository?.full_name === repository &&
        run.head_repository?.full_name === repository &&
        run.head_branch === "main" &&
        run.head_sha === commit &&
        ["push", "workflow_dispatch"].includes(run.event) &&
        run.status === "completed" &&
        run.conclusion === "success",
    );
    if (!verified)
      throw new Error(
        "Production deployment requires successful main-branch CI for this exact commit.",
      );
  }

  // Check the branch's current commit before deployment and reject outdated jobs.
  const ref = await request(`/git/ref/heads/${encodeURIComponent(branch)}`);
  if (!/^[a-f0-9]{40}$/.test(ref.object?.sha ?? ""))
    throw new Error("Invalid branch head response.");
  return { ...target, deploy: ref.object.sha === commit };
}

if (import.meta.main) {
  const repository = process.env.GITHUB_REPOSITORY;
  const target = await checkDeployment(
    {
      branch: process.env.SITE_BRANCH,
      refType: process.env.GITHUB_REF_TYPE ?? "",
      commit: process.env.SITE_COMMIT,
      repository,
      ciRunId: process.env.SITE_CI_RUN_ID,
    },
    async (path) => {
      const response = await fetch(
        `https://api.github.com/repos/${repository}${path}`,
        {
          signal: AbortSignal.timeout(10_000),
          headers: {
            Authorization: `Bearer ${process.env.GH_TOKEN}`,
            Accept: "application/vnd.github+json",
          },
        },
      );
      if (!response.ok)
        throw new Error(
          `Cannot verify deployment gate: HTTP ${response.status}.`,
        );
      return response.json();
    },
  );
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `deploy=${target.deploy}\nscript=${target.script}\nalias=${target.alias}\n`,
  );
  if (!target.deploy) {
    const summary =
      "Website deployment skipped: a newer branch commit superseded this build.\n";
    console.log(summary);
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  }
}
