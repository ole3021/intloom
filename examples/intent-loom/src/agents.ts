import { readFile } from "node:fs/promises";
import { agent, decodeUtf8 } from "@intloom/loom-sdk";
import { opinion, patch, specification, strategy } from "./schemas.ts";

export const analyze = agent({
  instructions: async () =>
    decodeUtf8(
      await readFile(new URL("../agents/analyst.md", import.meta.url)),
    ),
  returns: specification,
});
export const design = agent({
  instructions: async () =>
    decodeUtf8(
      await readFile(new URL("../agents/designer.md", import.meta.url)),
    ),
  returns: strategy,
});
export const implement = agent({
  instructions: async () =>
    decodeUtf8(
      await readFile(new URL("../agents/developer.md", import.meta.url)),
    ),
  returns: patch,
});
export const audit = agent({
  instructions: async () =>
    decodeUtf8(
      await readFile(new URL("../agents/auditor.md", import.meta.url)),
    ),
  skills: ["./skills/evidence-review"],
  returns: opinion,
});
