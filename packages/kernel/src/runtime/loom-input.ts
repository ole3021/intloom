import {
  parseLoomInput,
  parseSchemaValue,
  type LoomInvocationInput as LoomInput,
} from "@intloom/loom-sdk";
import type { Blueprint } from "@intloom/loom-sdk";
import { ERRORS } from "../errors.ts";

/** Validate and detach caller-owned arrays before any asynchronous preparation or execution. */
export function validateLoomInput(
  blueprint: Blueprint,
  input: unknown,
): LoomInput {
  try {
    return blueprint.capability
      ? parseSchemaValue(blueprint.capability.definition.input, input)
      : parseLoomInput(blueprint.inputs, input);
  } catch (cause) {
    throw ERRORS.wrap("INVALID_REQUEST", cause, {
      message: `Invalid Loom input: ${cause instanceof Error ? cause.message : String(cause)}`,
    });
  }
}
