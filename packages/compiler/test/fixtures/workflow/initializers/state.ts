import { writeFileSync } from "node:fs";

export default function initializeState(context: { readonly intent: string }) {
  // This marker must appear only after the consumer explicitly invokes the initializer.
  writeFileSync(
    new URL("../../stage-initialized.txt", import.meta.url),
    "initialized",
  );
  return { value: context.intent };
}
