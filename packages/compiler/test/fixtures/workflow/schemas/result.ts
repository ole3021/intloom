import * as z from "zod";
export default z.strictObject({ outcome: z.enum(["complete", "retry"]) });
