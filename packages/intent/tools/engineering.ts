import { defineAgentTool } from "@intloom/workflow-sdk";
import * as z from "zod";
import { projectPathSchema, commandSchema } from "../schemas/engineering.ts";
import { project, json } from "../src/flow/shared.ts";
export const listProject = defineAgentTool({
  id: "list_project_files",
  description:
    "List business file paths and content hashes in the bound project; generated output and IntLoom data are excluded.",
  inputSchema: z.strictObject({}),
  outputSchema: z.json(),
  execute: async (_input, access) => json(await project(access).snapshot()),
});
export const readProject = defineAgentTool({
  id: "read_project_file",
  description: "Read a UTF-8 business file relative to the bound project root.",
  inputSchema: z.strictObject({ path: projectPathSchema }),
  outputSchema: z.strictObject({ content: z.string() }),
  execute: async (input, access) => ({
    content: await project(access).read(input.path),
  }),
});
export const writeProject = defineAgentTool({
  id: "write_project_file",
  description:
    "Write one business file. Read existing contents first and retain unrelated changes. Native IDE editing is preferred when available.",
  inputSchema: z.strictObject({ path: projectPathSchema, content: z.string() }),
  outputSchema: z.strictObject({ saved: z.boolean() }),
  execute: async (input, access) => {
    await project(access).write(input.path, input.content);
    return { saved: true };
  },
});
export const removeProject = defineAgentTool({
  id: "remove_project_file",
  description:
    "Remove one obsolete business file required by the confirmed design. Record the deletion in implementation changes.",
  inputSchema: z.strictObject({ path: projectPathSchema }),
  outputSchema: z.strictObject({ removed: z.boolean() }),
  execute: async (input, access) => {
    await project(access).remove(input.path);
    return { removed: true };
  },
});
export const runProject = defineAgentTool({
  id: "run_project_command",
  description:
    "Execute a bounded project command without an implicit shell. Use command plus args, set cwd only to a project subdirectory. A returned nonzero exit is a failed command.",
  inputSchema: commandSchema,
  outputSchema: z.json(),
  execute: async (input, access) =>
    json(
      await project(access).run({
        command: input.command,
        args: input.args,
        ...(input.cwd ? { cwd: input.cwd } : {}),
        ...(input.timeoutMs ? { timeoutMs: input.timeoutMs } : {}),
      }),
    ),
});
