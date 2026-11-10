import { defineCode, defineLoom, withDefault } from "@intloom/loom-sdk";
import { z } from "zod";

export default defineLoom({
  id: "order-total",
  version: "1.0.0",
  description: "Sum integer prices and apply an optional quantity.",
  entry: defineCode({
    id: "total",
    inputSchema: z.object({
      prices: z.array(z.number().int().nonnegative()),
      quantity: withDefault(z.number().int().positive(), 1),
    }),
    outputSchema: z.number().int().nonnegative(),
    execute: ({ inputData }) =>
      inputData.prices.reduce((sum, price) => sum + price, 0) *
      inputData.quantity,
  }),
});
