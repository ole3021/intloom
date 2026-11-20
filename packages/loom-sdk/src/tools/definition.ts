import { z } from "zod";
import type { AgentDefinition } from "../exec/agent.ts";
import {
  getExecKind,
  type Exec,
  type ExecInput,
  type ValidExec,
} from "../exec/types.ts";
import { fileInputs } from "./fs.ts";
import { processInputSchema } from "./process.ts";
import { askInputSchema } from "./user.ts";
import { rejectInputSchema } from "../exec/result.ts";

export const builtinTools = {
  "fs.read": {
    description: "Read a UTF-8 file at a complete path.",
    input: fileInputs.read,
  },
  "fs.write": {
    description: "Write a UTF-8 file at a complete path.",
    input: fileInputs.write,
  },
  "fs.mkdir": {
    description: "Create a directory and its parents at a complete path.",
    input: fileInputs.mkdir,
  },
  "fs.stat": {
    description: "Inspect a path; missing paths return null.",
    input: fileInputs.stat,
  },
  "fs.list": {
    description: "List one directory level.",
    input: fileInputs.list,
  },
  "fs.remove": {
    description: "Remove a file or directory.",
    input: fileInputs.remove,
  },
  "fs.mkdtemp": {
    description: "Create a registered temporary directory.",
    input: fileInputs.mkdtemp,
  },
  "process.run": {
    description: "Run a command directly and return its execution receipt.",
    input: processInputSchema,
  },
  "user.ask": {
    description: "Ask the user a question and wait for their answer.",
    input: askInputSchema,
  },
  "execution.reject": {
    description: "Reject the current Exec with a readable reason.",
    input: rejectInputSchema,
  },
} as const;

export type BuiltinTool = keyof typeof builtinTools;
export const agentToolInputSchema = z.strictObject({ prompt: z.string() });

export type ToolDefinition =
  | BuiltinTool
  | {
      readonly exec: Exec;
      readonly description: string;
      readonly input?: z.ZodType;
    };

export const toolDefinitionSchema = z.union([
  z.custom<BuiltinTool>(
    (value) => typeof value === "string" && Object.hasOwn(builtinTools, value),
    "Unknown built-in tool",
  ),
  z
    .strictObject({
      exec: z.custom<Exec>(
        (value) => getExecKind(value) !== undefined,
        "Expected a Code, Agent or Workflow",
      ),
      description: z.string().trim().min(1),
      input: z.instanceof(z.ZodType).optional(),
    })
    .superRefine((tool, context) => {
      if (
        getExecKind(tool.exec) === "agent"
          ? tool.input !== undefined
          : tool.input === undefined
      ) {
        context.addIssue({
          code: "custom",
          path: ["input"],
          message:
            "Code/Workflow tools require input; Agent tools use the fixed prompt adapter and omit input",
        });
      }
    }),
]);

export type CheckedTools<T extends Record<string, ToolDefinition>> = {
  [K in keyof T]: T[K] extends { exec: infer E extends Exec }
    ? E extends AgentDefinition
      ? T[K] & { readonly input?: never } & ValidExec<E>
      : T[K] & { readonly input: z.ZodType<ExecInput<E>> } & ValidExec<E>
    : T[K];
};
