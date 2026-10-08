import { nanoid } from "nanoid";
import { LoomError } from "../error/index.ts";

export function generateId<Prefix extends string>(
  prefix: Prefix,
  size = 21,
): `${Prefix}-${string}` {
  if (typeof prefix !== "string" || prefix.length === 0 || /\s/u.test(prefix)) {
    throw new LoomError(
      "INVALID_ID_PREFIX",
      "ID prefix must be nonempty and contain no whitespace.",
    );
  }
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new LoomError(
      "INVALID_ID_SIZE",
      "ID size must be a positive safe integer.",
    );
  }
  return `${prefix}-${nanoid(size)}`;
}
