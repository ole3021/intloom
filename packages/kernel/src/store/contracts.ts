import { encodeUtf8, type KeyValueStorage } from "@intloom/loom-sdk";
import { z } from "zod";
import { pageOptionsSchema } from "../persistence/pagination.ts";

export interface StoreHandle extends KeyValueStorage {
  close(): Promise<void>;
}

export const keySchema = z.string().superRefine((key) => {
  encodeUtf8(key);
});

export const listSchema = pageOptionsSchema.extend({
  prefix: keySchema.default(""),
});
