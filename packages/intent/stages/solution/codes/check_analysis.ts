import type { ExecutableCode } from "@intloom/loom-sdk";
import { checkAnalysis } from "../src/steps.ts";
const code: ExecutableCode = (access) => checkAnalysis(access);
export default code;
