import { candidateReady, end } from "../mock/lifecycle.ts";
import type { MockRun } from "../mock/state.ts";
import { join } from "node:path";
import { mkdir, readFile, writeFile, mkdtemp, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { ArtifactRecord } from "@intloom/loom-sdk";
import pptxgen from "pptxgenjs";
import { strToU8, zipSync } from "fflate";

export async function artifactBytes(run: MockRun): Promise<Uint8Array> {
  const file = run.candidate;
  if (!file) throw Error("尚未生成候选文件。");
  if (file.format === "pptx") {
    const ppt = new pptxgen();
    ppt.layout = "LAYOUT_WIDE";
    ppt.author = "IntLoom Studio Mock";
    ppt.title = run.title;
    const pages = Number(run.launch.input.pages ?? 6);
    for (let i = 0; i < pages; i++) {
      const slide = ppt.addSlide();
      slide.background = { color: i === 0 ? "171717" : "FAFAFA" };
      const ink = i === 0 ? "FAFAFA" : "171717";
      slide.addText(
        i === 0 ? run.title : run.outline[(i - 1) % run.outline.length],
        {
          x: 0.7,
          y: 1.1,
          w: 12,
          h: 1.3,
          fontSize: 34,
          bold: true,
          color: ink,
          breakLine: false,
        },
      );
      slide.addText(
        i === 0
          ? "IntLoom · 模拟交付"
          : String(
              run.launch.input.changes ||
                run.launch.input.audience ||
                "内容验证示例",
            ),
        { x: 0.75, y: 3, w: 11, h: 1, fontSize: 20, color: ink },
      );
      slide.addText(`${run.summary.id}  /  ${i + 1}`, {
        x: 0.75,
        y: 6.6,
        w: 11,
        h: 0.4,
        fontSize: 12,
        color: ink,
      });
    }
    return new Uint8Array(
      (await ppt.write({ outputType: "arraybuffer" })) as ArrayBuffer,
    );
  }
  if (file.format === "json")
    return strToU8(JSON.stringify({ name: run.title, mock: true }, null, 2));
  const markdown =
    "# " +
    run.title +
    "\n\nIntLoom Mock · " +
    run.summary.id +
    "\n\n" +
    run.outline.map((t) => `- ${t}`).join("\n") +
    "\n\n" +
    run.answers
      .flatMap((a) =>
        a.action === "submit" && typeof a.value === "string" ? [a.value] : [],
      )
      .join("\n");
  if (file.format === "md") return strToU8(markdown);
  return zipSync({
    "README.md": strToU8(`${markdown}\n此 ZIP 包含模拟预览图。`),
    "preview.svg": strToU8(
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#171717"/><circle cx="320" cy="180" r="95" fill="#1ec71e"/><text x="22" y="333" fill="white" font-size="22">IntLoom · Mock preview</text></svg>',
    ),
  });
}
function artifactPath(
  directory: string,
  record: Pick<ArtifactRecord, "name" | "runId">,
) {
  return join(directory, "artifacts", record.runId, record.name);
}
export async function registerArtifact(
  directory: string,
  run: MockRun,
): Promise<ArtifactRecord> {
  const candidate = run.candidate;
  if (!candidate) throw Error("候选文件不存在。");
  const path = artifactPath(directory, candidate);
  // An earlier process may have fixed the bytes immediately before saving the receipt.
  let bytes: Uint8Array;
  try {
    bytes = await readFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    bytes = await artifactBytes(run);
    await mkdir(join(directory, "artifacts", candidate.runId), {
      recursive: true,
    });
    await writeFile(`${path}.tmp`, bytes, { mode: 0o600 });
    await rename(`${path}.tmp`, path);
  }
  return {
    id: candidate.id,
    name: candidate.name,
    createdAt: candidate.createdAt,
    mediaType: candidate.mediaType,
    runId: candidate.runId,
    executionId: `${candidate.runId}-delivery`,
    origin: { componentId: "delivery" },
    size: bytes.length,
    digest: createHash("sha256").update(bytes).digest("hex"),
  };
}
export async function copyArtifact(
  directory: string,
  record: ArtifactRecord,
  folder?: string,
) {
  const bytes = await readFile(artifactPath(directory, record)).catch(() => {
    throw Error("ARTIFACT_UNAVAILABLE · 固定版本的文件不可用。");
  });
  if (
    bytes.length !== record.size ||
    createHash("sha256").update(bytes).digest("hex") !== record.digest
  )
    throw Error("ARTIFACT_UNAVAILABLE · 文件与登记的固定版本不符。");
  if (!folder) {
    const previews = join(directory, "previews");
    await mkdir(previews, { recursive: true });
    folder = await mkdtemp(join(previews, "open-"));
  }
  const dest = join(folder, record.name);
  await writeFile(dest, bytes, { flag: "wx", mode: 0o600 });
  return dest;
}

/** Fix candidate bytes once at the lifecycle boundary; queries never perform I/O. */
export function createCandidateWriter(directory: string, changed: () => void) {
  const preparing = new Set<string>();
  return async (runs: MockRun[]) => {
    const candidates = runs.filter(
      (run) =>
        run.candidate &&
        !run.artifact &&
        !run.artifactIssue &&
        !preparing.has(run.summary.id),
    );
    await Promise.all(
      candidates.map(async (run) => {
        preparing.add(run.summary.id);
        try {
          run.artifact = await registerArtifact(directory, run);
          candidateReady(run, new Date().toISOString());
        } catch (error) {
          run.artifactIssue = String(error);
          if (run.stage === "preparing" && run.summary.status === "running") {
            run.summary = {
              ...run.summary,
              error: {
                code: "ARTIFACT_UNAVAILABLE",
                message: "候选文件生成失败。",
              },
            };
            end(run, "failed", new Date().toISOString());
          }
        } finally {
          preparing.delete(run.summary.id);
        }
        changed();
      }),
    );
  };
}
