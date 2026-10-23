import type {
  AgentExecutionAccess,
  CodeExecutionAccess,
  JsonValue,
} from "@intloom/loom-sdk";
import { fail } from "./errors.ts";
export type StageAccess = Pick<
  AgentExecutionAccess<JsonValue>,
  "state" | "storage" | "signal" | "project"
>;
export type StageCodeAccess = CodeExecutionAccess<JsonValue>;
export function project(access: StageAccess) {
  if (!access.project)
    fail(
      "This Stage requires host-bound project operations.",
      "MISSING_INTENT_CAPABILITY",
    );
  return access.project;
}
