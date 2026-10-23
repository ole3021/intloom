export * from "@intloom/kernel/operations";

import * as z from "zod";
export interface ProjectInput {
  readonly projectPath: string;
  readonly serviceInstanceId?: string;
}
export interface ObserveOptions {
  readonly signal?: AbortSignal;
}
export const projectInputSchema = z.object({
  projectPath: z.string().min(1),
  serviceInstanceId: z.uuid().optional(),
});
