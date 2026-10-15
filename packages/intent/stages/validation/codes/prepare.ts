import type { ExecutableCode } from "@intloom/loom-sdk";
import { prepare } from "../src/steps.ts";
const code: ExecutableCode = (access) => prepare(access);
export default code;
