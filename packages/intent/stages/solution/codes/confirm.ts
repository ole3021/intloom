import type { ExecutableCode } from "@intloom/loom-sdk";
import { confirm } from "../src/steps.ts";
const code: ExecutableCode = (access) => confirm(access);
code.recover = (saved, access) => confirm(access, saved);
export default code;
