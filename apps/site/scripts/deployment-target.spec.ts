import assert from "node:assert/strict";
import test from "node:test";
import {
  checkDeployment,
  selectDeploymentTarget,
} from "./deployment-target.mjs";

test("only main selects a production deployment", () => {
  assert.deepEqual(selectDeploymentTarget("main"), {
    script: "deploy:production",
    alias: "",
  });
  for (const branch of [
    undefined,
    "",
    "master",
    "fix-bug",
    "feat/search",
    "feat-search/nested",
  ]) {
    assert.throws(() => selectDeploymentTarget(branch), /Only main and feat-/);
  }
  for (const refType of ["tag", ""]) {
    assert.throws(
      () => selectDeploymentTarget("main", refType),
      /Only main and feat-/,
    );
  }
});

test("feature aliases are bounded, safe, stable and distinct", () => {
  const branches = [
    "feat-Search",
    "feat-search",
    "feat-\u4e2d\u6587",
    `feat-${"x".repeat(100)}`,
    `feat-${"x".repeat(100)}-other`,
  ];
  const aliases = branches.map((branch) => {
    const target = selectDeploymentTarget(branch);
    assert.equal(target.script, "deploy:preview");
    assert.match(target.alias, /^[a-z][a-z0-9-]{0,30}$/);
    assert.deepEqual(selectDeploymentTarget(branch), target);
    return target.alias;
  });
  assert.equal(new Set(aliases).size, aliases.length);
});

const commit = "a".repeat(40);
const repository = "ole3021/intloom";
const production = { branch: "main", refType: "branch", commit, repository };
const successfulCi = {
  path: ".github/workflows/ci.yml",
  repository: { full_name: repository },
  head_repository: { full_name: repository },
  head_branch: "main",
  head_sha: commit,
  event: "push",
  status: "completed",
  conclusion: "success",
};

test("preview deployment does not depend on package CI", async () => {
  const paths: string[] = [];
  const target = await checkDeployment(
    { ...production, branch: "feat-website" },
    async (path: string) => {
      paths.push(path);
      return { object: { sha: commit } };
    },
  );
  assert.equal(target.deploy, true);
  assert.equal(target.script, "deploy:preview");
  assert.deepEqual(paths, ["/git/ref/heads/feat-website"]);
});

test("production verifies the triggering CI run against the deployed commit", async () => {
  const paths: string[] = [];
  const target = await checkDeployment(
    { ...production, ciRunId: "123" },
    async (path: string) => {
      paths.push(path);
      return path === "/actions/runs/123"
        ? successfulCi
        : { object: { sha: commit } };
    },
  );
  assert.deepEqual(target, {
    script: "deploy:production",
    alias: "",
    deploy: true,
  });
  assert.deepEqual(paths, ["/actions/runs/123", "/git/ref/heads/main"]);
});

test("production rejects unrelated, failed, incomplete and untrusted CI runs", async (t) => {
  const mismatches = [
    { head_sha: "b".repeat(40) },
    { head_branch: "feat-website" },
    { path: ".github/workflows/website.yml" },
    { repository: { full_name: "other/intloom" } },
    { head_repository: { full_name: "fork/intloom" } },
    { event: "pull_request" },
    { event: "workflow_run" },
    { status: "in_progress" },
    { conclusion: "failure" },
    { conclusion: "cancelled" },
    { conclusion: "skipped" },
  ];
  for (const mismatch of mismatches) {
    await t.test(JSON.stringify(mismatch), async () => {
      await assert.rejects(
        checkDeployment({ ...production, ciRunId: "123" }, async () => ({
          ...successfulCi,
          ...mismatch,
        })),
        /requires successful main-branch CI for this exact commit/,
      );
    });
  }
});

test("manual production requires a successful CI run for the exact SHA", async () => {
  const paths: string[] = [];
  const target = await checkDeployment(production, async (path: string) => {
    paths.push(path);
    return path.startsWith("/actions/")
      ? { workflow_runs: [{ ...successfulCi, event: "workflow_dispatch" }] }
      : { object: { sha: commit } };
  });
  assert.equal(target.deploy, true);
  assert.equal(
    paths[0],
    `/actions/workflows/ci.yml/runs?branch=main&head_sha=${commit}&status=success&per_page=100`,
  );
  for (const runs of [[], [{ ...successfulCi, head_sha: "b".repeat(40) }]]) {
    await assert.rejects(
      checkDeployment(production, async () => ({ workflow_runs: runs })),
      /requires successful main-branch CI/,
    );
  }
});

test("superseded builds skip deployment even after successful CI", async () => {
  for (const branch of ["main", "feat-website"]) {
    const target = await checkDeployment(
      { ...production, branch, ciRunId: "123" },
      async (path: string) =>
        path.startsWith("/actions/")
          ? successfulCi
          : { object: { sha: "b".repeat(40) } },
    );
    assert.equal(target.deploy, false);
  }
});

test("invalid deployment identity fails before requesting GitHub", async () => {
  for (const mismatch of [
    { commit: "main" },
    { repository: "" },
    { refType: "tag" },
    { ciRunId: "123/other" },
  ]) {
    await assert.rejects(
      checkDeployment({ ...production, ...mismatch }, async () => {
        assert.fail("Invalid deployment identity must not request GitHub");
      }),
      /Deployment requires|Only main and feat-|Invalid CI run ID/,
    );
  }
});

test("GitHub failures and malformed branch data fail closed", async () => {
  await assert.rejects(
    checkDeployment(production, async () => {
      throw new Error("GitHub unavailable");
    }),
    /GitHub unavailable/,
  );
  await assert.rejects(
    checkDeployment(
      { ...production, branch: "feat-website" },
      async () => ({}),
    ),
    /Invalid branch head response/,
  );
});
