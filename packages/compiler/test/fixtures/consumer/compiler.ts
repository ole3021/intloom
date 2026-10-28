import {
  compileLoom,
  checkLoom,
  inspectLoom,
  scaffoldLoom,
} from "@intloom/compiler";
import type { OpenLogOptions } from "@intloom/utils";

const logging: OpenLogOptions = {
  directory: "/logs",
  pino: {
    serializers: {
      secret: (value: { secret: string }) => ({
        ...value,
        secret: "[redacted]",
      }),
    },
  },
};
void logging;

type Options = Parameters<typeof compileLoom>[0];
const options: Options = {
  packageRoot: "/loom",
  tsconfigFile: "build.json",
};
const result: Promise<import("@intloom/compiler").CompileResult> =
  compileLoom(options);
void result;
// @ts-expect-error packageRoot is required.
const missingRoot: Options = {};
// @ts-expect-error tsconfigFile must be a path string.
const invalidConfig: Options = { packageRoot: "/loom", tsconfigFile: 42 };
void missingRoot;
void invalidConfig;
void checkLoom(options);
void inspectLoom(options.packageRoot);
void scaffoldLoom("/new-loom", "agent");
// @ts-expect-error Unsupported templates are rejected by the authoring API.
void scaffoldLoom("/new-loom", "app");
