import { appendFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";

const origin = new URL(process.env.SITE_URL);
const checks = [
  ["/", 200],
  ["/guide/introduction", 200],
  ["/__intloom_missing_page__", 404],
];

// 允许边缘部署短暂传播；检查失败仍使发布任务明确失败。
for (const [path, status] of checks) {
  let passed = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(new URL(path, origin), {
        signal: AbortSignal.timeout(10_000),
      });
      passed = response.status === status;
      await response.body?.cancel();
    } catch {
      passed = false;
    }
    if (passed) break;
    if (attempt < 2) await setTimeout(5_000);
  }
  if (!passed)
    throw new Error(
      `Site verification failed: ${path}; expected HTTP ${status}.`,
    );
}

const summary = `Site verified: ${origin.href}\nCommit: ${process.env.GITHUB_SHA ?? "local"}\n`;
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
