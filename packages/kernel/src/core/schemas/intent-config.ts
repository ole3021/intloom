import { z } from "zod";
import { nonEmptyStringSchema } from "./common.ts";

const commonAppShape = {
  name: nonEmptyStringSchema,

  // Stores specified dependencies or technology preferences that affect design, including frameworks and ORMs.
  // Avoid a duplicate framework field; project files own the complete installed dependency list and locked versions.
  dependencies: z
    .array(
      z.strictObject({
        name: nonEmptyStringSchema,
        description: nonEmptyStringSchema,
      }),
    )
    .optional(),
  // Stores architectural patterns or design preferences that can be combined, not mutually exclusive enum values.
  patterns: z
    .array(
      z.strictObject({
        name: nonEmptyStringSchema,
        description: nonEmptyStringSchema,
      }),
    )
    .optional(),
};

// #region SolutionApp
export const SolutionAppType = {
  Web: "web",
  Service: "service",
  Worker: "worker",
  Mobile: "mobile",
  Desktop: "desktop",
  MiniApp: "mini-app",
} as const;
export type SolutionAppType =
  (typeof SolutionAppType)[keyof typeof SolutionAppType];
// #region SolutionApp Web Schema
const webAppSchema = z.strictObject({
  ...commonAppShape,

  type: z.literal(SolutionAppType.Web),
});
// #endregion
// #region SolutionApp Service Schema
export const SolutionServerRuntime = {
  Node: "node",
  Python: "python",
  JVM: "jvm",
  DotNet: "dotnet",
  Go: "go",
  Rust: "rust",
  Edge: "edge",
} as const;
export type SolutionServerRuntime =
  (typeof SolutionServerRuntime)[keyof typeof SolutionServerRuntime];

const serviceAppSchema = z.strictObject({
  ...commonAppShape,

  type: z.literal(SolutionAppType.Service),
  runtime: nonEmptyStringSchema.optional(),
});

const workerAppSchema = z.strictObject({
  ...commonAppShape,

  type: z.literal(SolutionAppType.Worker),
  runtime: nonEmptyStringSchema.optional(),
});
// #endregion
// #region SolutionApp Mobile Schema
export const SolutionMobilePlatform = {
  iOS: "ios",
  Android: "android",
} as const;
export type SolutionMobilePlatform =
  (typeof SolutionMobilePlatform)[keyof typeof SolutionMobilePlatform];

const mobileAppSchema = z.strictObject({
  ...commonAppShape,

  type: z.literal(SolutionAppType.Mobile),
  platforms: z.array(z.enum(SolutionMobilePlatform)).min(1),
});
// #endregion
// #region SolutionApp Desktop Schema
export const SolutionDesktopPlatform = {
  macOS: "macos",
  Windows: "windows",
  Linux: "linux",
} as const;
export type SolutionDesktopPlatform =
  (typeof SolutionDesktopPlatform)[keyof typeof SolutionDesktopPlatform];

const desktopAppSchema = z.strictObject({
  ...commonAppShape,

  type: z.literal(SolutionAppType.Desktop),
  platforms: z.array(z.enum(SolutionDesktopPlatform)).min(1),
});
// #endregion
// #region SolutionApp MiniApp Schema
export const SolutionMiniAppPlatform = {
  WeChat: "wechat",
  Alipay: "alipay",
  Douyin: "douyin",
  QQ: "qq",
  Baidu: "baidu",
} as const;
export type SolutionMiniAppPlatform =
  (typeof SolutionMiniAppPlatform)[keyof typeof SolutionMiniAppPlatform];

const miniAppSchema = z.strictObject({
  ...commonAppShape,

  type: z.literal(SolutionAppType.MiniApp),
  platforms: z.array(z.enum(SolutionMiniAppPlatform)).min(1),
});
// #endregion

// #endregion

export const intentConfigSchema = z.strictObject({
  apps: z.array(
    z.discriminatedUnion("type", [
      webAppSchema,
      serviceAppSchema,
      workerAppSchema,
      mobileAppSchema,
      desktopAppSchema,
      miniAppSchema,
    ]),
  ),
});
