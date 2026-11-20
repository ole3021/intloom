import {
  relativePathSchema,
  type CompiledLoom,
  type PackageIdentity,
} from "@intloom/loom-sdk";
import { z } from "zod";

export interface InstallationInput {
  readonly directory: string;
  readonly packagePath: string;
  readonly source?: string;
}

export const installationInputSchema = z.strictObject({
  directory: z.string().min(1),
  packagePath: z.union([z.literal("."), relativePathSchema]),
  source: z.string().min(1).optional(),
});

export interface Installation {
  readonly package: PackageIdentity;
  readonly directory: string;
  readonly packagePath: string;
  readonly manifest: CompiledLoom;
  readonly source?: string;
  readonly registeredAt: string;
  readonly dependencies: readonly {
    readonly path: string;
    readonly name: string;
    readonly version: string;
  }[];
}
