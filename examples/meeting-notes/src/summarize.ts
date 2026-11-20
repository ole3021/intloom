import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { agent, decodeUtf8, type LoomEntry } from "@intloom/loom-sdk";
import { z } from "zod";

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

export const minutes = agent({
  instructions: async () =>
    decodeUtf8(await readFile(new URL("../editor.md", import.meta.url))),
  returns: z.strictObject({
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
});

function inline(value: string) {
  return value
    .trim()
    .replace(/[\r\n]+/g, " ")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replace(/[\\`*_[\]|>]/g, "\\$&");
}

const summarize: LoomEntry = async (input, context) => {
  if (
    input.folders?.length ||
    (input.prompt?.trim()
      ? Boolean(input.files?.length)
      : input.files?.length !== 1)
  ) {
    throw new Error(
      "Provide either meeting text or exactly one file, without folders.",
    );
  }
  let text: string;
  if (input.prompt?.trim()) {
    text = input.prompt;
  } else {
    const path = input.files?.[0];
    if (!path || ![".md", ".txt"].includes(extname(path).toLowerCase())) {
      throw new Error("EXPECTED_TXT_OR_MD");
    }
    text = await context.fs.read({ path });
  }
  if (!text.trim()) throw new Error("EMPTY_MEETING_SOURCE");
  const lines = text.split(/\r\n|\n|\r/);
  const notes = await context.exec(
    minutes,
    JSON.stringify(lines.map((text, i) => ({ line: i + 1, text }))),
  );
  switch (notes.kind) {
    case "agenda-only":
      return context.reject({ reason: "AGENDA_WITHOUT_DISCUSSION" });
    case "unrelated":
      return context.reject({ reason: "NOT_MEETING_CONTENT" });
    case "insufficient":
      return context.reject({ reason: "INSUFFICIENT_MEETING_CONTENT" });
  }
  if (
    !notes.title.trim() ||
    !notes.fullHeading.trim() ||
    !notes.sections.length
  ) {
    throw new Error("INCOMPLETE_MEETING_NOTES");
  }
  const highlights: string[] = [];
  const full: string[] = [];
  for (const section of notes.sections) {
    if (!section.heading.trim()) throw new Error("INCOMPLETE_MEETING_NOTES");
    if (section.heading.trim() !== notes.fullHeading.trim())
      full.push(`### ${inline(section.heading)}`, "");
    for (const item of section.points) {
      const statement = inline(item.statement);
      if (!statement) throw new Error("INCOMPLETE_MEETING_NOTES");
      if (item.highlight) highlights.push(`- ${statement}`);
      full.push(`- ${statement}`);
      for (const { line, quote } of item.evidence) {
        if (!quote.trim() || !lines[line - 1]?.includes(quote))
          throw new Error("UNVERIFIED_SOURCE_QUOTE");
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
  await context.fs.write({
    path: `${context.workDir}/meeting-notes.md`,
    content: [
      `# ${inline(notes.title)}`,
      "",
      ...highlights.slice(0, 5),
      "",
      `## ${inline(notes.fullHeading)}`,
      "",
      ...full,
    ].join("\n"),
  });
};

export default summarize;
