import * as z from "zod";
const schema = z.strictObject({
  outcome: z.enum(["ready", "clarification_required"]),
});
export default schema;
