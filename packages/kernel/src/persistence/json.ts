export function jsonText(value: unknown): string {
  const ancestors = new Set<object>();
  function validate(item: unknown): void {
    if (item === null || typeof item === "string" || typeof item === "boolean")
      return;
    if (typeof item === "number" && Number.isFinite(item)) return;
    if (typeof item !== "object" || item === null)
      throw new TypeError("Expected a JSON value with finite numbers");
    if (
      !Array.isArray(item) &&
      Object.getPrototypeOf(item) !== Object.prototype &&
      Object.getPrototypeOf(item) !== null
    )
      throw new TypeError("Expected a plain JSON object or array");
    if (ancestors.has(item))
      throw new TypeError("JSON values cannot contain cycles");
    ancestors.add(item);
    for (const child of Array.isArray(item) ? item : Object.values(item))
      validate(child);
    ancestors.delete(item);
  }
  validate(value);
  return JSON.stringify(value);
}
