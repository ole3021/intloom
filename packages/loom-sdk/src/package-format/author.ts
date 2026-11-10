import { z } from "zod";
import { assertPackagePath } from "./package.ts";

const name = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/);
const path = z.string().refine((value) => {
  try {
    assertPackagePath(value);
    return true;
  } catch {
    return false;
  }
}, "Expected a relative file inside the Loom package");
const schema = z.record(z.string(), z.json());
export const authorManifest = z
  .strictObject({
    name: z.string().min(1),
    description: z.string().min(1),
    defaultCommand: name.optional(),
    check: path.optional(),
    permissions: z.array(z.string()).optional(),
    confirmations: z.record(z.string(), z.string()).optional(),
    examples: z.array(z.json()).optional(),
    models: z
      .record(
        name,
        z.strictObject({
          strength: z.string(),
          capabilities: z.array(z.enum(["tool_use", "structured_output"])),
        }),
      )
      .optional(),
    looms: z
      .record(
        z.string().regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/),
        z.string().min(1),
      )
      .optional(),
    commands: z.record(
      name,
      z.strictObject({
        description: z.string().min(1),
        entry: path,
        input: schema,
        output: z.string().min(1),
      }),
    ),
  })
  .superRefine((value, ctx) => {
    const keys = Object.keys(value.commands);
    if (
      !keys.length ||
      (keys.length > 1 && !value.defaultCommand) ||
      (value.defaultCommand &&
        !Object.hasOwn(value.commands, value.defaultCommand))
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Specify one default command for a multi-command Loom",
      });
    }
  });
export type AuthorManifest = z.infer<typeof authorManifest>;
