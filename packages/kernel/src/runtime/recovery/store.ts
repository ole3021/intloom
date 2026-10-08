import {
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import * as z from "zod";
import { pendingUserActionSchema } from "../schemas/pending-user-action.ts";
import { cursorSchema } from "../../workflow/schemas/cursor.ts";

const savedStageSchema = z.strictObject({
  input: z.json().optional(),
  value: z.json().optional(),
});
export type SavedStage = z.infer<typeof savedStageSchema>;
export const checkpointSchema = z.strictObject({
  version: z.literal(1),
  workflowIdentity: z.string().min(1),
  phase: z.enum([
    "stage_pending",
    "step_ready",
    "executing",
    "step_result",
    "waiting",
    "answered",
    "terminal",
  ]),
  run: z.strictObject({
    id: z.string().min(1),
    flowName: z.string().min(1),
    intent: z.string().min(1),
    execution: z.strictObject({
      source: z.enum(["cli", "studio", "agent_ide"]),
      agentExecutor: z.enum(["service", "mcp_client"]),
    }),
    cursor: cursorSchema,
    status: z.enum(["running", "waiting", "completed", "failed"]),
    pendingAction: pendingUserActionSchema.optional(),
    pendingAgentCall: z
      .strictObject({
        id: z.string().min(1),
        agentId: z.string().min(1),
        phase: z.enum(["available", "claimed"]),
        createdAt: z.iso.datetime(),
      })
      .optional(),
    lastError: z
      .strictObject({
        code: z.string(),
        message: z.string(),
        retryable: z.boolean(),
      })
      .optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  }),
  stage: savedStageSchema.optional(),
  result: z.strictObject({ outcome: z.string().min(1) }).optional(),
  answer: z.json().optional(),
  answeredAction: pendingUserActionSchema.optional(),
});
export type RunCheckpoint = z.infer<typeof checkpointSchema>;
export type CheckpointPhase = RunCheckpoint["phase"];

/** One writer is owned by the project host. Files are recovery copies, never live read state. */
export function openRunCheckpointStore(directory: string) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (
    !lstatSync(directory).isDirectory() ||
    lstatSync(directory).isSymbolicLink()
  )
    throw new Error("Runtime recovery directory must be a real directory.");
  const name = (id: string) =>
    `${createHash("sha256").update(id).digest("hex")}.json`;
  const written = new Set<string>();
  const forgotten = new Set<string>();
  let failure: unknown;
  function read() {
    const checkpoints: RunCheckpoint[] = [];
    if (!existsSync(directory)) return checkpoints;
    for (const filename of readdirSync(directory).sort()) {
      if (!filename.endsWith(".json")) continue;
      const path = join(directory, filename);
      const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const checkpoint = checkpointSchema.parse(
          JSON.parse(readFileSync(fd, "utf8")),
        );
        if (name(checkpoint.run.id) !== filename)
          throw new Error("Checkpoint filename does not match its Run.");
        checkpoints.push(checkpoint);
        written.add(checkpoint.run.id);
      } finally {
        closeSync(fd);
      }
    }
    return checkpoints;
  }
  function write(input: unknown) {
    if (failure) throw failure;
    const checkpoint = checkpointSchema.parse(input);
    const id = checkpoint.run.id;
    const target = join(directory, name(id));
    // Explicit removal opts this Run out of recovery for the remainder of this process.
    if (forgotten.has(id)) return;
    if (!existsSync(directory) || (written.has(id) && !existsSync(target))) {
      forgotten.add(id);
      return;
    }
    const temporary = join(directory, `.${randomUUID()}.tmp`);
    try {
      if (
        !lstatSync(directory).isDirectory() ||
        lstatSync(directory).isSymbolicLink()
      )
        throw new Error("Runtime recovery directory was replaced.");
      if (existsSync(target) && lstatSync(target).isSymbolicLink())
        throw new Error("Checkpoint cannot be a symbolic link.");
      const fd = openSync(temporary, "wx", 0o600);
      try {
        writeFileSync(fd, JSON.stringify(checkpointSchema.parse(checkpoint)));
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      renameSync(temporary, target);
      const directoryFd = openSync(
        directory,
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      try {
        fsyncSync(directoryFd);
      } finally {
        closeSync(directoryFd);
      }
      written.add(id);
    } catch (cause) {
      failure = cause;
      throw cause;
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary);
    }
  }
  return { read, write };
}
export type RunCheckpointStore = ReturnType<typeof openRunCheckpointStore>;
