import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);
export async function processResult(
  command: string,
  args: readonly string[],
  cwd: string,
  timeout: number,
  signal?: AbortSignal,
  environmentOverrides: NodeJS.ProcessEnv = {},
) {
  const environment = { ...process.env, ...environmentOverrides };
  delete environment.NODE_TEST_CONTEXT;
  delete environment.NODE_OPTIONS;
  try {
    const result = await execute(command, [...args], {
      cwd,
      env: environment,
      timeout,
      maxBuffer: 16 * 1024 * 1024,
      ...(signal ? { signal } : {}),
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("stdout" in error) ||
      !("stderr" in error)
    )
      throw error;
    return {
      code: "code" in error && typeof error.code === "number" ? error.code : 1,
      stdout: String(error.stdout),
      stderr: String(error.stderr),
      terminated: "killed" in error && error.killed === true,
    };
  }
}
