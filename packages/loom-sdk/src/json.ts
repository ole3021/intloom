export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type ReadonlyData<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { readonly [K in keyof T]: ReadonlyData<T[K]> }
    : T;

export type JsonData<T> = T extends string | number | boolean | null
  ? T
  : T extends (...args: never[]) => unknown
    ? never
    : T extends readonly unknown[]
      ? { [K in keyof T]: JsonData<T[K]> }
      : T extends object
        ? {
            [K in keyof T]: Record<never, never> extends Pick<T, K>
              ? JsonData<Exclude<T[K], undefined>> | Extract<T[K], undefined>
              : JsonData<T[K]>;
          }
        : never;

export type JsonResult<T> =
  Exclude<T, void> extends JsonData<Exclude<T, void>> ? T : never;
