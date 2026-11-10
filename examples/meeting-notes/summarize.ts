import { readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import {
  defineAgent,
  defineCode,
  InputFileRefSchema,
  ResultFileSchema,
  resultFile,
  workDirectory,
} from "@intloom/loom-sdk";
import editor from "intloom:agent/editor.md";
import { z } from "zod";

const source = z.union([
  z.strictObject({ prompt: z.string().min(1) }),
  z.strictObject({ files: z.tuple([InputFileRefSchema]) }),
]);

const point = z.strictObject({
  statement: z.string().min(1),
  highlight: z.boolean(),
  evidence: z
    .array(
      z.strictObject({
        line: z.number().int().positive(),
        quote: z.string().min(1),
      }),
    )
    .min(1),
});

const minutes = defineAgent({
  ...editor,
  inputSchema: z.array(z.string()),
  outputSchema: z.strictObject({
    kind: z.enum([
      "review",
      "sync",
      "exploration",
      "action",
      "agenda-only",
      "unrelated",
      "insufficient",
    ]),
    title: z.string(),
    fullHeading: z.string(),
    sections: z.array(
      z.strictObject({
        heading: z.string().min(1),
        points: z.array(point).min(1),
      }),
    ),
  }),
  model: { slot: "editor" },
  outputMode: "structured",
  prompt: ({ inputData }) =>
    JSON.stringify(inputData.map((text, i) => ({ line: i + 1, text }))),
  generation: { maxSteps: 1, maxOutputTokens: 8192 },
});

function inline(value: string) {
  return value
    .trim()
    .replace(/[\r\n]+/g, " ")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replace(/[\\`*_[\]|>]/g, "\\$&");
}

export default defineCode({
  id: "summarize",
  inputSchema: source,
  outputSchema: ResultFileSchema,
  uses: { agents: [minutes] },
  async execute({ inputData, context }) {
    let text: string;
    if ("prompt" in inputData) {
      text = inputData.prompt;
    } else {
      const path = inputData.files[0].path;
      if (![".md", ".txt"].includes(extname(path).toLowerCase()))
        return context.fail("EXPECTED_TXT_OR_MD");
      const bytes = await readFile(path);
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        return context.fail("EXPECTED_UTF8_TEXT");
      }
    }
    if (!text.trim()) return context.fail("EMPTY_MEETING_SOURCE");
    const lines = text.split(/\r\n|\n|\r/);
    const notes = await context.agents.generate(minutes, lines);
    switch (notes.kind) {
      case "agenda-only":
        return context.fail("AGENDA_WITHOUT_DISCUSSION");
      case "unrelated":
        return context.fail("NOT_MEETING_CONTENT");
      case "insufficient":
        return context.fail("INSUFFICIENT_MEETING_CONTENT");
    }

    if (
      !notes.title.trim() ||
      !notes.fullHeading.trim() ||
      !notes.sections.length
    )
      return context.fail("INCOMPLETE_MEETING_NOTES");
    const highlights: string[] = [];
    const full: string[] = [];
    for (const section of notes.sections) {
      if (section.heading.trim() !== notes.fullHeading.trim())
        full.push(`### ${inline(section.heading)}`, "");
      for (const item of section.points) {
        const statement = inline(item.statement);
        if (!statement) return context.fail("INCOMPLETE_MEETING_NOTES");
        if (item.highlight) highlights.push(`- ${statement}`);
        full.push(`- ${statement}`);
        for (const { line, quote } of item.evidence) {
          if (!quote.trim() || !lines[line - 1]?.includes(quote))
            return context.fail("UNVERIFIED_SOURCE_QUOTE");
          full.push(`  > L${line} · ${inline(quote)}`);
        }
      }
      full.push("");
    }
    if (!highlights.length) {
      for (const { points } of notes.sections) {
        const first = points[0];
        if (first) highlights.push(`- ${inline(first.statement)}`);
      }
    }
    const document = [
      `# ${inline(notes.title)}`,
      "",
      ...highlights.slice(0, 5),
      "",
      `## ${inline(notes.fullHeading)}`,
      "",
      ...full,
    ].join("\n");
    await writeFile(
      join(workDirectory(context.run), "meeting-notes.md"),
      document,
    );
    return resultFile("meeting-notes.md", "text/markdown");
  },
});
