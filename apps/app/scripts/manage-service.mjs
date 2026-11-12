// Run with Studio's Node so npm and Kernel use the same runtime on each platform.
import { createHash } from "node:crypto";
import { copyFile, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import {
  createServiceClient,
  installGlobalLoom,
  removeGlobalLoom,
  startStudioService,
} from "@intloom/cli/local-service";
import { inspectNpmLoomArchive, npmRoot, runNpm } from "@intloom/kernel";

const [operation, dataDir, source, expectedIntegrity] = process.argv.slice(2);

async function packageOperation(root) {
  const directory = await mkdtemp(join(tmpdir(), "studio-loom-"));
  try {
    let archive;
    if (isAbsolute(source)) {
      archive = join(directory, "loom.tgz");
      await copyFile(source, archive).catch(() => {
        throw Error("无法读取本地 .tgz 文件，请重新选择。");
      });
    } else {
      try {
        await runNpm([
          "pack",
          "--ignore-scripts",
          "--loglevel=error",
          "--pack-destination",
          directory,
          "--",
          source,
        ]);
      } catch (error) {
        const code = /npm (?:error|ERR!) code ([A-Z0-9_]+)/i.exec(
          error.stderr,
        )?.[1];
        if (
          operation === "preview" &&
          ["EJSONPARSE", "TAR_BAD_ARCHIVE", "ENOPACKAGEJSON"].includes(code)
        ) {
          process.stdout.write("null");
          return;
        }
        throw Error(
          `npm 无法读取这个包，请检查包名、地址和 npm 配置后重试。${code ? " (" + code + ")" : ""}`,
        );
      }
      const [filename] = await readdir(directory);
      archive = join(directory, filename);
    }
    const integrity = createHash("sha512")
      .update(await readFile(archive))
      .digest("hex");
    if (expectedIntegrity && integrity !== expectedIntegrity)
      throw Error("来源的包内容已经变化，请重新读取包信息后安装。");
    const pkg = await inspectNpmLoomArchive(archive, root).catch((error) => {
      if (
        error instanceof SyntaxError ||
        ["PackageError", "ZodError", "YAMLParseError"].includes(error.name) ||
        error.code === "TAR_BAD_ARCHIVE"
      )
        return null;
      throw error;
    });
    if (operation === "preview") {
      process.stdout.write(JSON.stringify(pkg && { ...pkg, integrity }));
      return;
    }
    if (!pkg) throw Error("所选来源没有可安装的 Loom。");
    try {
      await installGlobalLoom(archive);
    } catch (error) {
      if (!("stderr" in error)) throw error;
      const code = /npm (?:error|ERR!) code ([A-Z0-9_]+)/i.exec(
        error.stderr,
      )?.[1];
      const target = error.cmd?.split(" -- ").at(-1);
      const child =
        target &&
        /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+@[a-zA-Z0-9.~^*+-]+$/.test(target)
          ? target
          : pkg.id;
      throw Error(
        `npm 安装 ${child} 失败${code ? " (" + code + ")" : ""}，请检查 npm 配置和依赖后重试。`,
      );
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

if (operation === "start") await startStudioService(dataDir);
else {
  const root = await npmRoot(true);
  if (operation !== "preview") {
    const service = await createServiceClient(dataDir)("serviceStatus");
    if (service.npmGlobalRoot !== root)
      throw Error("Studio 与共享服务使用的 npm 目录不同，请检查服务配置。");
  }
  if (operation === "preview" || operation === "install")
    await packageOperation(root);
  else if (operation === "remove") await removeGlobalLoom(source, dataDir);
  else throw Error("Unknown Studio service operation");
}
