import type { ExecutableCode } from "@intloom/loom-sdk";
import { check } from "../src/steps.ts";
const code: ExecutableCode = (access) => check(access);
export default code;
