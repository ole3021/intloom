export function cliArgs(
  binary: string,
  serviceDir: string,
  ...args: string[]
): string[];
export function shutdown(
  binary: string,
  serviceDir: string,
): Promise<{ status: "stopped" }>;
