import { randomUUID } from "node:crypto";
import {
  askRequestSchema,
  askSubmissionSchema,
  createAnswerSchema,
  describeQuestion,
  type AskInput,
  type AskRequest,
  type AskResult,
  type JsonValue,
  type UserTools,
} from "@intloom/loom-sdk";

export interface Interaction {
  readonly id: string;
  readonly question: AskInput;
  readonly status: "pending" | "deferred";
  readonly draft?: JsonValue;
  readonly issues: readonly {
    readonly path: readonly (string | number)[];
    readonly message: string;
  }[];
}

export type SubmissionResult =
  | { readonly status: "accepted" }
  | { readonly status: "pending"; readonly interaction: Interaction };

export class Interactions {
  readonly #pending = new Map<
    string,
    {
      interaction: Interaction;
      schema: ReturnType<typeof createAnswerSchema>;
      resolve: (result: unknown) => void;
      reject: (error: unknown) => void;
    }
  >();

  constructor(
    private readonly signal: AbortSignal,
    private readonly notify?: (interaction: Interaction) => void,
  ) {
    signal.addEventListener(
      "abort",
      () => {
        for (const pending of this.#pending.values())
          pending.reject(signal.reason);
        this.#pending.clear();
      },
      { once: true },
    );
  }

  readonly user: UserTools = {
    ask: <const Q extends AskRequest>(input: Q): Promise<AskResult<Q>> => {
      this.signal.throwIfAborted();
      const request = askRequestSchema.parse(input);
      const schema = createAnswerSchema(request);
      const interaction: Interaction = {
        id: randomUUID(),
        question: describeQuestion(request),
        status: "pending",
        issues: [],
      };
      return new Promise((resolve, reject) => {
        this.#pending.set(interaction.id, {
          interaction,
          schema,
          resolve: (result) => resolve(result as AskResult<Q>),
          reject,
        });
        try {
          this.notify?.(structuredClone(interaction));
        } catch (error) {
          this.#pending.delete(interaction.id);
          reject(error);
        }
      });
    },
  };

  list(): readonly Interaction[] {
    return [...this.#pending.values()].map(({ interaction }) =>
      structuredClone(interaction),
    );
  }

  submit(id: string, input: unknown): SubmissionResult {
    this.signal.throwIfAborted();
    const pending = this.#pending.get(id);
    if (!pending) throw new Error(`No pending interaction '${id}'`);
    const submission = askSubmissionSchema.parse(input);
    const { question } = pending.interaction;
    if (submission.status === "deferred") {
      if (!question.allowDefer)
        throw new Error("This question does not allow deferring");
      pending.interaction = { ...pending.interaction, status: "deferred" };
    } else if (submission.status === "skipped") {
      if (!question.allowSkip)
        throw new Error("This question does not allow skipping");
      this.#pending.delete(id);
      pending.resolve(submission);
      return { status: "accepted" };
    } else {
      const answer = pending.schema.safeParse(submission.value);
      if (answer.success) {
        this.#pending.delete(id);
        pending.resolve({ status: "answered", value: answer.data });
        return { status: "accepted" };
      }
      pending.interaction = {
        ...pending.interaction,
        status: "pending",
        draft: submission.value,
        issues: answer.error.issues.map(({ path, message }) => ({
          path: path.map((part) =>
            typeof part === "symbol" ? String(part) : part,
          ),
          message,
        })),
      };
    }
    const interaction = structuredClone(pending.interaction);
    this.notify?.(interaction);
    return { status: "pending", interaction };
  }
}
