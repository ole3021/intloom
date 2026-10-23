import { codexAdapter } from "./codex/interaction.ts";
import type { IdeAdapter } from "./contracts.ts";

const adapters: Readonly<Record<string, IdeAdapter>> = Object.freeze({
  codex: codexAdapter,
});
export function resolveIde(id: string | undefined) {
  return id && Object.hasOwn(adapters, id) ? adapters[id] : undefined;
}
