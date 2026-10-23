import * as z from "zod";

export const echoTool = {
  id: "echo",
  description: "Echo a value",
  inputSchema: z.string(),
  outputSchema: z.string(),
  execute: async (value: string) => `echo:${value}`,
};
