import { compileWorkflow } from "@intloom/compiler";
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

type Options = Parameters<typeof compileWorkflow>[0];
const options: Options = {
  packageRoot: "/workflow",
  tsconfigFile: "build.json",
};
const result: Promise<void> = compileWorkflow(options);
void result;
// @ts-expect-error packageRoot is required.
const missingRoot: Options = {};
// @ts-expect-error tsconfigFile must be a path string.
const invalidConfig: Options = { packageRoot: "/workflow", tsconfigFile: 42 };
void missingRoot;
void invalidConfig;
