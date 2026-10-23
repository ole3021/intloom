import type { ExecutableCode } from "@intloom/loom-sdk";
import { verify } from "../src/steps.ts";
const code: ExecutableCode = (access) => verify(access);
export default code;
