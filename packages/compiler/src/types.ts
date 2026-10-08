import type { Logger } from "@intloom/utils";

export interface CompileOptions {
  readonly logger?: Logger;
  readonly packageRoot: string;
  readonly tsconfigFile?: string;
}
