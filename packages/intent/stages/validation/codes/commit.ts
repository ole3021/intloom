import type { ExecutableCode } from "@intloom/loom-sdk";
import { commit } from "../src/steps.ts";
const code: ExecutableCode = (access) => commit(access);
export default code;
