import { isLoomError } from "@intloom/kernel";
import {
  lstat,
  mkdir,
  open,
  readdir,
  realpath,
  rmdir,
  unlink,
  readFile,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { failure } from "../errors.ts";
import { parseDocument } from "yaml";
import { installWorkflows } from "../workflows/install.ts";

const directories = [
  "intloom",
  "intloom/project",
  "intloom/artifacts",
  "intloom/records",
  ".intloom",
  ".intloom/workflows",
] as const;

const configuration = `# IntLoom project configuration.
# Only workflows is maintained by the CLI. Other fields are user-managed.
localStorage: file
useMcpAgent: true
workflows: []
intent:
  apps: []
# Before CLI/Studio or service Agent execution, configure llms.default.
# The shared service can start without model configuration.
# llms:
#   default:
#     provider: openai-compatible
#     model: <your-model-id>
#     secret: ENV.MODEL_API_KEY
#     baseURL: https://your-provider.example/v1
`;

export interface InitResult {
  readonly projectRoot: string;
  readonly status: "scaffolded";
}

/** Creates a new scaffold only; it neither loads a project nor starts a service. */
export async function initProject(
  directory: string,
  workflows: readonly string[] = [],
): Promise<InitResult> {
  if (!directory.trim())
    throw failure("INVALID_REQUEST", "Provide a nonempty project directory.");
  let root = resolve(directory);
  const created: { path: string; directory: boolean }[] = [];
  async function createFile(name: string, content: string) {
    const path = join(root, name);
    const file = await open(path, "wx");
    created.push({ path, directory: false });
    try {
      await file.writeFile(content, "utf8");
    } finally {
      await file.close();
    }
  }
  try {
    const target = await lstat(root).catch((cause: unknown) => {
      if (cause instanceof Error && "code" in cause && cause.code === "ENOENT")
        return undefined;
      throw cause;
    });
    if (target && !target.isDirectory())
      throw failure(
        "CLI_INIT_TARGET_INVALID",
        "The initialization target must be a directory, not a file or symlink.",
      );
    await mkdir(root, { recursive: true });
    root = await realpath(root);
    if ((await readdir(root)).length)
      throw failure(
        "CLI_INIT_TARGET_NOT_EMPTY",
        "Initialize a new or empty directory. Existing projects and files are not overwritten.",
      );

    // Exclusive creation also prevents competing init calls from sharing a scaffold.
    await createFile("intloom.yaml", configuration);
    for (const directory of directories) {
      const path = join(root, directory);
      await mkdir(path, {
        mode: directory.startsWith(".intloom") ? 0o700 : 0o755,
      });
      created.push({ path, directory: true });
    }
    await createFile(".gitignore", "/.intloom/\n/intloom/store.lock\n");
    if (workflows.length) {
      const installed = await installWorkflows(root, workflows);
      const filename = join(root, "intloom.yaml");
      const document = parseDocument(await readFile(filename, "utf8"));
      document.set("workflows", installed);
      await writeFile(filename, document.toString());
    }
    return { projectRoot: root, status: "scaffolded" };
  } catch (cause) {
    // Remove only entries created here; nonempty directories and other files survive.
    for (const entry of created.reverse())
      await (entry.directory ? rmdir(entry.path) : unlink(entry.path)).catch(
        () => {},
      );
    if (isLoomError(cause)) throw cause;
    throw failure(
      "CLI_INIT_FAILED",
      "Cannot initialize the project. Check the target path, permissions, and any partial scaffold before retrying.",
      cause,
    );
  }
}
