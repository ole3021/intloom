import { basename, isAbsolute } from "node:path";

const npmSpec =
  /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:@[a-zA-Z0-9.~^*+-]+)?$/;
const noRelease =
  "这个仓库尚未提供可安装的 Loom，请使用作者提供的 npm 包名或本地 .tgz。";
const invalid =
  "请输入 GitHub 仓库或 Release 地址、npm 包名、npm 包页面地址，或选择本地 .tgz 文件。";

export type InstallSource = {
  kind: "npm" | "archive" | "github";
  spec: string;
  label: string;
};
export { noRelease };

export async function resolveInstallSource(
  input: string,
  request: (
    url: string,
    init: RequestInit,
  ) => Promise<Response> = globalThis.fetch,
): Promise<InstallSource[]> {
  const spec = input.trim();
  if (isAbsolute(spec) && spec.endsWith(".tgz"))
    return [{ kind: "archive", spec, label: basename(spec) }];
  if (npmSpec.test(spec)) return [{ kind: "npm", spec, label: "npm" }];
  const url = URL.parse(spec);
  if (url?.protocol !== "https:" || url.username || url.password || url.port)
    throw Error(invalid);
  const path = decodeURIComponent(url.pathname).replace(/\/$/, "");
  if (["www.npmjs.com", "npmjs.com"].includes(url.hostname)) {
    const match = /^\/package\/((?:@[^/]+\/)?[^/]+)(?:\/v\/([^/]+))?$/.exec(
      path,
    );
    const name = match && match[1] + (match[2] ? "@" + match[2] : "");
    if (!name || !npmSpec.test(name)) throw Error(invalid);
    return [{ kind: "npm", spec: name, label: "npm" }];
  }
  if (url.hostname !== "github.com") throw Error(invalid);
  const match = /^\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/(.*))?$/.exec(path);
  if (!match) throw Error(invalid);
  const [, owner, repo, location = ""] = match;
  const repository = owner + "/" + repo;
  const asset = /^releases\/download\/(.+)\/([^/]+\.tgz)$/.exec(location);
  if (asset)
    return [
      {
        kind: "github",
        spec: url.origin + url.pathname,
        label: `GitHub · ${repository} · ${asset[1]} · ${asset[2]}`,
      },
    ];
  const latestAsset = /^releases\/latest\/download\/([^/]+\.tgz)$/.exec(
    location,
  )?.[1];
  const tag = /^releases\/tag\/(.+)$/.exec(location)?.[1];
  if (location && location !== "releases/latest" && !latestAsset && !tag)
    throw Error(invalid);
  const endpoint = tag ? "tags/" + encodeURIComponent(tag) : "latest";
  const response = await request(
    `https://api.github.com/repos/${repository}/releases/${endpoint}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "IntLoom-Studio",
      },
      signal: AbortSignal.timeout(20000),
    },
  ).catch(() => {
    throw Error("无法连接 GitHub，请检查网络后重试。");
  });
  if (response.status === 404)
    throw Error("找不到公开仓库或所选 Release。" + noRelease);
  if (
    response.status === 429 ||
    (response.status === 403 &&
      response.headers.get("x-ratelimit-remaining") === "0")
  )
    throw Error(
      "GitHub 请求已达限额。请稍后重试，或直接粘贴该 Release 的 .tgz 附件地址。",
    );
  if (!response.ok)
    throw Error(
      `无法读取 GitHub Release（HTTP ${response.status}），请稍后重试。`,
    );
  const release = await response.json();
  if (typeof release.tag_name !== "string" || !Array.isArray(release.assets))
    throw Error("GitHub 返回的 Release 信息不完整，请重试。");
  const sources: InstallSource[] = [];
  for (const asset of release.assets) {
    if (
      typeof asset?.name !== "string" ||
      !asset.name.endsWith(".tgz") ||
      asset.state !== "uploaded" ||
      (latestAsset && asset.name !== latestAsset)
    )
      continue;
    const download = URL.parse(asset.browser_download_url);
    if (
      download?.origin !== "https://github.com" ||
      download.username ||
      download.password ||
      !/^\/[\w.-]+\/[\w.-]+\/releases\/download\/.+\/.+\.tgz$/.test(
        download.pathname,
      )
    )
      continue;
    sources.push({
      kind: "github",
      spec: download.origin + download.pathname,
      label: `GitHub · ${repository} · ${release.tag_name} · ${asset.name}`,
    });
  }
  if (!sources.length) throw Error(noRelease);
  return sources;
}
