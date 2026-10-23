import * as z from "zod";
const resultSchema = z.strictObject({
  outcome: z.enum(["ready", "needs_input", "needs_evidence"]),
});
export default resultSchema;
