/** Reject values that JSON would silently drop, transform or coerce. */
export function jsonCopy<T>(value: T): T {
  const parents = new Set<object>();
  function visit(item: unknown): void {
    if (item === null || typeof item === "string" || typeof item === "boolean")
      return;
    if (
      typeof item === "number" &&
      Number.isFinite(item) &&
      !Object.is(item, -0)
    )
      return;
    if (typeof item !== "object" || !item)
      throw new Error("Data must round-trip as JSON.");
    if (parents.has(item)) throw new Error("Data contains a cycle.");
    if (
      !Array.isArray(item) &&
      ![Object.prototype, null].includes(Object.getPrototypeOf(item))
    )
      throw new Error("Data contains a non-JSON object.");
    if (Reflect.ownKeys(item).some((key) => typeof key !== "string"))
      throw new Error("Data contains symbol keys.");
    parents.add(item);
    if (Array.isArray(item)) {
      if (Object.getPrototypeOf(item) !== Array.prototype)
        throw new Error("JSON arrays cannot be class instances.");
      if (Object.keys(item).length !== item.length)
        throw new Error(
          "JSON arrays must be dense and have no extra properties.",
        );
      for (const part of item) visit(part);
    } else {
      for (const descriptor of Object.values(
        Object.getOwnPropertyDescriptors(item),
      )) {
        if (!descriptor.enumerable || !("value" in descriptor))
          throw new Error("Data contains an accessor or hidden property.");
        visit(descriptor.value);
      }
    }
    parents.delete(item);
  }
  visit(value);
  return JSON.parse(JSON.stringify(value)) as T;
}
