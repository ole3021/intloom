import type { ExecutableCode } from "@intloom/loom-sdk";
import { checkScope } from "../src/steps.ts";
const code: ExecutableCode = (access) => checkScope(access);
export default code;
