import { valid } from "semver";
import { z } from "zod";

export const loomIdSchema = z
  .string()
  .regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/);

export const packageVersionSchema = z
  .string()
  .refine(
    (version) => valid(version) === version,
    "Expected a complete semantic version",
  );

export const packageIdentitySchema = z.strictObject({
  name: loomIdSchema,
  version: packageVersionSchema,
});

export type PackageIdentity = z.infer<typeof packageIdentitySchema>;
