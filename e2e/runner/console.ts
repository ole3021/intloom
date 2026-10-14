import { Console } from "node:console";
import { Writable } from "node:stream";
import { finished } from "node:stream/promises";
import type { Evidence } from "./evidence.ts";

/** Only the single-execution command entry owns the process-wide console. */
export function captureConsole(evidence: Evidence) {
  const previous = globalThis.console;
  const output = new Writable({
    write(chunk, _encoding, done) {
      evidence.event("sdk_diagnostic", { message: String(chunk) }).then(
        () => done(),
        (cause) => done(cause),
      );
    },
  });
  output.on("error", () => {});
  globalThis.console = new Console({ stdout: output, stderr: output });
  return async () => {
    globalThis.console = previous;
    output.end();
    await finished(output);
  };
}
