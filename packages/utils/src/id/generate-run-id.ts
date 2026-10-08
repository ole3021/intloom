import { nanoid } from "nanoid";
import { formatIdTimestamp } from "./timestamp.ts";

export function generateRunId(date = new Date()): `RUN-${string}` {
  return `RUN-${formatIdTimestamp(date)}-${nanoid(21)}`;
}
