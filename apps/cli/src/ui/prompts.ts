import * as p from "@clack/prompts";
import { IntloomError } from "@intloom/loom-sdk";
import { isPlainOutput } from "./output-mode.ts";

export const terminalIO = { output: process.stderr };
export function interactive() {
  return (
    !isPlainOutput() &&
    !process.env.CI &&
    Boolean(process.stdin.isTTY && process.stderr.isTTY)
  );
}

export class PromptCancelled extends IntloomError {
  constructor() {
    super("PROMPT_CANCELLED", "Interaction cancelled.");
  }
}
export function answer<T extends string | boolean | number | number[]>(
  value: T | typeof p.CANCEL_SYMBOL,
): T {
  if (typeof value === "symbol") throw new PromptCancelled();
  return value;
}

export async function choose(
  message: string,
  labels: string[],
  search = false,
) {
  const options = labels.map((label, value) => ({ label, value }));
  const props = { ...terminalIO, message, options, maxItems: 8 };
  return answer(
    await (search && options.length > 7
      ? p.autocomplete(props)
      : p.select(props)),
  );
}
export async function menu<const T extends string>(
  message: string,
  options: readonly { value: T; label: string }[],
): Promise<T> {
  return answer(
    await p.select({
      ...terminalIO,
      message,
      options: options.map(({ value, label }) => ({
        value: value as string,
        label,
      })),
    }),
  ) as T;
}
export async function confirm(message: string) {
  return answer(
    await p.confirm({
      ...terminalIO,
      message,
      initialValue: false,
      active: "Yes",
      inactive: "No",
    }),
  );
}
