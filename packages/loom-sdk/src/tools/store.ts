import type { JsonValue } from "../json.ts";

export interface KeyValueStorage {
  get(key: string): Promise<JsonValue | undefined>;
  set(key: string, value: JsonValue): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: {
    readonly prefix?: string;
    readonly limit?: number;
    readonly cursor?: string;
  }): Promise<{
    readonly entries: readonly {
      readonly key: string;
      readonly value: JsonValue;
    }[];
    readonly nextCursor?: string;
  }>;
}
