import { basename } from "node:path";

const privateKeys =
  /^(?:authorization|cookie|setcookie|password|passwd|secret|apikey|token|accesstoken|refreshtoken|credential|credentials|headers|env|environment|intent|prompt|instructions|answer|answers|useranswer|content|body|requestbody|responsebody|state|input|output)$/iu;

export function privateLogKey(key: string): boolean {
  return privateKeys.test(key.replaceAll(/[_-]/gu, ""));
}

export function safeLogText(value: string): string {
  return value
    .replaceAll(/\bBearer\s+\S+/giu, "Bearer [REDACTED]")
    .replaceAll(/\bsk-[A-Za-z0-9_-]+/gu, "[REDACTED]")
    .replaceAll(/https?:\/\/[^\s]+/gu, "[URL]")
    .replaceAll(/\p{Cc}/gu, " ")
    .slice(0, 256);
}

/** Never serialize arbitrary Error messages, SDK payloads, or stack headings. */
export function serializeLogError(error: unknown): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const seen = new Set<unknown>();
  const causes: string[] = [];
  let current = error;
  for (
    let depth = 0;
    depth < 4 && current && typeof current === "object";
    depth++
  ) {
    if (seen.has(current)) break;
    seen.add(current);
    const descriptors = Object.getOwnPropertyDescriptors(current);
    const status: unknown =
      descriptors.statusCode?.value ?? descriptors.status?.value;
    if (
      result.status === undefined &&
      typeof status === "number" &&
      Number.isInteger(status) &&
      status >= 100 &&
      status <= 599
    )
      result.status = status;
    const code: unknown = descriptors.code?.value;
    const safeCode =
      typeof code === "string" && /^[A-Z][A-Z0-9_]{0,79}$/u.test(code)
        ? code
        : "UNKNOWN_ERROR";
    if (depth === 0) {
      result.code = safeCode;
      if (typeof descriptors.retryable?.value === "boolean")
        result.retryable = descriptors.retryable.value;
      const stack: unknown = descriptors.stack?.value;
      if (typeof stack === "string") {
        const frames = stack
          .split("\n")
          .slice(1, 9)
          .flatMap((line) => {
            const match = /(?:\(|\s)([^()\s]+):(\d+):(\d+)\)?$/u.exec(line);
            return match?.[1]
              ? [`${safeLogText(basename(match[1]))}:${match[2]}:${match[3]}`]
              : [];
          });
        if (frames.length) result.stack = frames;
      }
    } else causes.push(safeCode);
    current = descriptors.cause?.value;
  }
  if (!result.code) result.code = "UNKNOWN_ERROR";
  if (causes.length) result.causes = causes;
  return result;
}

/** Bounded traversal skips accessors and toJSON, and never mutates caller data. */
export function sanitizeLogFields(
  fields: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  let remaining = 4096;
  let truncated = false;
  const seen = new Set<object>();
  function visit(value: unknown, depth: number): unknown {
    if (remaining <= 0 || depth > 4) {
      truncated = true;
      return undefined;
    }
    remaining -= 8;
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "number")
      return Number.isFinite(value) ? value : undefined;
    if (typeof value === "string") {
      const text = safeLogText(value).slice(0, remaining);
      remaining -= text.length;
      if (text.length < value.length) truncated = true;
      return text;
    }
    if (!value || typeof value !== "object") return undefined;
    if (seen.has(value)) {
      truncated = true;
      return undefined;
    }
    seen.add(value);
    try {
      if (Array.isArray(value)) {
        if (value.length > 12) truncated = true;
        return Array.from(
          { length: Math.min(value.length, 12) },
          (_, index) => {
            const descriptor = Object.getOwnPropertyDescriptor(value, index);
            return descriptor && "value" in descriptor
              ? (visit(descriptor.value, depth + 1) ?? null)
              : null;
          },
        );
      }
      const result: Record<string, unknown> = Object.create(null);
      const descriptors = Object.getOwnPropertyDescriptors(value);
      const keys = Object.keys(descriptors);
      if (keys.length > 24) truncated = true;
      for (const key of keys.slice(0, 24)) {
        if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(key)) continue;
        if (
          privateLogKey(key) ||
          ["__proto__", "constructor", "prototype"].includes(key)
        )
          continue;
        remaining -= key.length;
        const descriptor = descriptors[key];
        if (!descriptor?.enumerable || !("value" in descriptor)) continue;
        const next = visit(descriptor.value, depth + 1);
        if (next !== undefined) result[safeLogText(key)] = next;
      }
      return result;
    } finally {
      seen.delete(value);
    }
  }
  const result = visit(fields, 0) as Record<string, unknown>;
  if (truncated) result.truncated = true;
  return result;
}
