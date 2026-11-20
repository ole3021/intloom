import { pathToFileURL } from "node:url";
import { bindingSchema, errorMessage, Peer } from "./protocol.ts";
import { executionContext } from "./context.ts";
import type { CompleteExecution } from "./contracts.ts";

let execution: ReturnType<typeof executionContext> | undefined;
const peer = new Peer(
  (message) =>
    new Promise<void>((resolve, reject) => {
      if (!process.connected || !process.send) {
        reject(new Error("Scheduling host disconnected"));
        return;
      }
      process.send(message, (error: Error | null) =>
        error ? reject(error) : resolve(),
      );
    }),
  async (operation, data) => {
    if (operation !== "answer" || !execution)
      throw new Error(`Unexpected host request: ${operation}`);
    return execution.answer(data);
  },
  (error) => {
    process.stderr.write(errorMessage(error));
    process.exit(1);
  },
  (reason) => execution?.cancel(reason),
);
process.on("message", (message) => peer.receive(message));
process.on("disconnect", () => {
  execution?.cancel("Scheduling host disconnected");
  peer.close();
  process.exit(1);
});
process.on("unhandledRejection", (error) => execution?.fail(error));
process.on("uncaughtException", (error) => execution?.fail(error));
try {
  const binding = bindingSchema.parse(await peer.request("ready", {}));
  execution = executionContext(peer, binding);
  let completion: CompleteExecution;
  try {
    const module = await import(pathToFileURL(binding.module).href);
    completion = await execution.run(module[binding.export]);
  } catch (error) {
    completion = { result: { status: "failed", reason: errorMessage(error) } };
  }
  await peer.request("done", completion);
  process.exit(0);
} catch (error) {
  process.stderr.write(errorMessage(error));
  process.exit(1);
}
