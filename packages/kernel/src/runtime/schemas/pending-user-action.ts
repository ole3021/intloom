import * as z from "zod";
import { cursorSchema } from "../../workflow/schemas/cursor.ts";
import type { PendingUserAction } from "../run-view.ts";

/** Checks the authoritative action's public shape; the corresponding question or confirmation Schema validates request contents. */
export const pendingUserActionSchema = z.strictObject({
  id: z.string().min(1),
  flowName: z.string().min(1),
  cursor: cursorSchema,
  kind: z.enum(["user_ask_questions", "user_ask_confirmation"]),
  request: z.json(),
  createdAt: z.iso.datetime(),
}) satisfies z.ZodType<PendingUserAction>;
