import * as z from "zod";
const schema = z.strictObject({ outcome: z.enum(["ready"]) });
export default schema;
