import type { Readable, Writable } from "node:stream";
import * as prompts from "@clack/prompts";
import pc from "picocolors";

export interface Choice {
  readonly value: string;
  readonly label: string;
  readonly hint?: string;
}
export interface PromptApi {
  choose(
    message: string,
    choices: readonly Choice[],
  ): Promise<string | undefined>;
  text(message: string, required: boolean): Promise<string | undefined>;
}
export interface TerminalUi extends PromptApi {
  readonly interactive: boolean;
  readonly json: boolean;
  result(value: unknown, message: string): void;
  error(value: unknown, message: string): void;
  note(message: string): void;
  work<T>(message: string, operation: () => Promise<T>): Promise<T>;
}
export interface TerminalOptions {
  readonly onPromptState?: (active: boolean) => void;
  readonly progress?: boolean;
  readonly input: Readable;
  readonly output: Writable;
  readonly error: Writable;
  readonly interactive: boolean;
  readonly json: boolean;
  readonly color: boolean;
  readonly prompts?: PromptApi;
}

/** Results go to stdout and progress to stderr; JSON mode does not prompt or emit ANSI sequences. */
export function createTerminalUi(options: TerminalOptions): TerminalUi {
  const colors = pc.createColors(options.color && !options.json);
  const api: PromptApi = options.prompts ?? {
    async choose(message, choices) {
      const answer = await prompts.select({
        message,
        options: [...choices],
        input: options.input,
        output: options.error,
      });
      return prompts.isCancel(answer) ? undefined : answer;
    },
    async text(message, required) {
      const answer = await prompts.multiline({
        message: `${message}\n  Enter: new line · Tab then Enter: submit · Esc: cancel input`,
        showSubmit: true,
        input: options.input,
        output: options.error,
        validate: (value) =>
          required && !value?.trim() ? "Enter some text" : undefined,
      });
      return prompts.isCancel(answer) ? undefined : answer;
    },
  };
  return {
    interactive: options.interactive && !options.json,
    json: options.json,
    async choose(message, choices) {
      options.onPromptState?.(true);
      try {
        return await api.choose(message, choices);
      } finally {
        options.onPromptState?.(false);
      }
    },
    async text(message, required) {
      options.onPromptState?.(true);
      try {
        return await api.text(message, required);
      } finally {
        options.onPromptState?.(false);
      }
    },
    result(value, message) {
      options.output.write(
        options.json ? `${JSON.stringify(value)}\n` : `${message}\n`,
      );
    },
    error(value, message) {
      (options.json ? options.output : options.error).write(
        options.json
          ? `${JSON.stringify(value)}\n`
          : `${colors.red("Failure")} · ${message}\n`,
      );
    },
    note(message) {
      if (!options.json) options.error.write(`${colors.dim(message)}\n`);
    },
    async work(message, operation) {
      if (!options.interactive || options.json || options.progress === false)
        return operation();
      const spinner = prompts.spinner({ output: options.error });
      spinner.start(message);
      try {
        const value = await operation();
        spinner.stop(message);
        return value;
      } catch (error) {
        spinner.stop("Operation did not complete");
        throw error;
      }
    },
  };
}
