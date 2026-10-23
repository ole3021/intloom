export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Uses explicit recursion to avoid expanding recursive mapped types over JsonValue. */
export type ReadonlyJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly ReadonlyJsonValue[]
  | { readonly [key: string]: ReadonlyJsonValue };

type ReadonlyFields<T> = T extends object
  ? { readonly [Key in keyof T]: ReadonlyValue<T[Key]> }
  : T;

/** Generic JSON uses explicit recursive types; concrete business types retain their field structure. */
export type ReadonlyValue<T> = [JsonValue] extends [T]
  ? [T] extends [ReadonlyJsonValue]
    ? ReadonlyJsonValue
    : ReadonlyFields<T>
  : ReadonlyFields<T>;
