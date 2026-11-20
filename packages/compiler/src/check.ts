import { type CompilerOptions, prepare } from "./prepare.ts";

export function check(options: CompilerOptions = {}) {
  return prepare(options, async () => {});
}
