import type { ExecutableCode } from "@intloom/workflow-sdk";
import {
  readValidation,
  reviewValidation,
} from "../../src/validation/review.ts";
const check = (async (_input, access) => {
  await reviewValidation(access, readValidation(access));
  return { outcome: "valid" };
}) satisfies ExecutableCode;
export default check;
