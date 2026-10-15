import type { StageStateContext } from "@intloom/loom-sdk";
import { writeFileSync } from "node:fs";

export default function initializeState(context: StageStateContext) {
  // This marker must appear only after the consumer explicitly invokes the initializer.
  writeFileSync(
    new URL("../../stage-initialized.txt", import.meta.url),
    "initialized",
  );
  return { value: context.input.prompt ?? "" };
}
