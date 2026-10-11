import { createCliRenderer } from "@opentui/core";
import { render } from "@opentui/solid";
import { App } from "./app.tsx";
export async function runTui(projectPath: string): Promise<number> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    process.stderr.write(
      "TUI requires a terminal. Use intloom --help for CMD operations.\n",
    );
    return 1;
  }
  const renderer = await createCliRenderer({
    screenMode: "alternate-screen",
    exitOnCtrlC: false,
  });
  const terminate = () => renderer.destroy();
  process.once("SIGTERM", terminate);
  process.once("SIGHUP", terminate);
  try {
    await render(() => App({ projectPath }), renderer);
    await renderer.closed;
    return 0;
  } finally {
    renderer.destroy();
    process.off("SIGTERM", terminate);
    process.off("SIGHUP", terminate);
  }
}
