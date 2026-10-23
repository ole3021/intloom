import type { ExecutableCode } from "@intloom/loom-sdk";
import { resolve } from "../src/steps.ts";
const code: ExecutableCode = (access) => resolve(access);
code.recover = (saved, access) => resolve(access, saved);
export default code;
