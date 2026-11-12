import { repositoryUrl } from "./src/site.ts";
import {
  cliReleasesUrl,
  latestReleaseUrl,
  studioTargets,
} from "./src/releases.ts";

const repoApi = "https://api.github.com/repos/ole3021/intloom";
const api = `${repoApi}/releases`;

const stableCli = /^(?:@intloom\/cli@|intloom@)(\d+\.\d+\.\d+)$/;

async function github(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "intloom-site",
    },
    signal: AbortSignal.timeout(10000),
    ...options,
    cf: {
      cacheEverything: true,
      cacheTtlByStatus: { "200-299": 300, "400-599": -1 },
    },
  });
  return response;
}

function published(release, pattern) {
  if (
    release?.draft !== false ||
    release.prerelease !== false ||
    typeof release.tag_name !== "string"
  )
    return;
  const match = pattern.exec(release.tag_name);
  if (
    match &&
    typeof release.html_url === "string" &&
    release.html_url.startsWith(`${repositoryUrl}/releases/tag/`)
  ) {
    return { version: match[1], url: release.html_url };
  }
}

async function apiRequest(url, { allowMissing = false } = {}) {
  const response = await github(url);
  if (
    response.status === 429 ||
    (response.status === 403 &&
      response.headers.get("x-ratelimit-remaining") === "0")
  ) {
    await response.body?.cancel();
    return null;
  }
  if (allowMissing && response.status === 404) return response;
  if (!response.ok) throw new Error(`GitHub releases: HTTP ${response.status}`);
  return response;
}

function newestFirst(a, b) {
  return b.version.localeCompare(a.version, "en", { numeric: true });
}

// GitHub's public release and branch pages also work when anonymous API reads are throttled.
async function cliFromReleasePage() {
  const candidates = [];
  for (let pageNumber = 1; ; pageNumber++) {
    const page = await github(`${cliReleasesUrl}&page=${pageNumber}`, {
      headers: { Accept: "text/html", "User-Agent": "intloom-site" },
    });
    if (!page.ok) throw new Error(`GitHub release page: HTTP ${page.status}`);
    let badge;
    let commit;
    let nextPage = false;
    const selector = "section[data-release-anchor]";
    const document = new HTMLRewriter()
      .on(selector, {
        element(section) {
          badge = "";
          commit = undefined;
          const tag = section
            .getAttribute("data-release-anchor")
            ?.replace(/^release-/, "");
          const version = stableCli.exec(tag)?.[1];
          section.onEndTag(() => {
            if (version && commit && !/pre-release|draft/i.test(badge))
              candidates.push({
                version,
                commit,
                url: `${repositoryUrl}/releases/tag/${encodeURIComponent(tag)}`,
              });
          });
        },
      })
      .on(`${selector} .Label`, {
        text(chunk) {
          badge += chunk.text;
        },
      })
      .on(`${selector} a[data-hovercard-type="commit"]`, {
        element(link) {
          commit ??= link
            .getAttribute("href")
            ?.match(/\/commit\/([a-f0-9]{40})$/)?.[1];
        },
      })
      .on('a[rel="next"]', {
        element() {
          nextPage = true;
        },
      })
      .transform(page);
    await document.body.pipeTo(new WritableStream());
    if (!nextPage) break;
  }

  for (const { version, url, commit } of candidates.sort(newestFirst)) {
    const page = await github(`${repositoryUrl}/branch_commits/${commit}`, {
      headers: { Accept: "text/html", "User-Agent": "intloom-site" },
    });
    if (!page.ok) throw new Error(`GitHub branch list: HTTP ${page.status}`);
    let onMain = false;
    let name;
    const branches = new HTMLRewriter()
      .on("li.branch a", {
        element(link) {
          name = "";
          link.onEndTag(() => {
            if (name.trim() === "main") onMain = true;
          });
        },
        text(chunk) {
          name += chunk.text;
        },
      })
      .transform(page);
    await branches.body.pipeTo(new WritableStream());
    if (onMain) return { version, url };
  }
}

async function latestStudio() {
  const response = await apiRequest(`${api}/latest`);
  if (response) {
    const record = await response.json();
    const studio = published(record, /^app-v(\d+\.\d+\.\d+)$/);
    if (studio && Array.isArray(record.assets))
      return { studio, assets: record.assets };
  } else {
    const page = await github(latestReleaseUrl, {
      method: "HEAD",
      redirect: "manual",
    });
    const url = page.headers.get("location") ?? "";
    const tagPrefix = `${repositoryUrl}/releases/tag/app-v`;
    const version = url.startsWith(tagPrefix) && url.slice(tagPrefix.length);
    if (page.status === 302 && version && /^\d+\.\d+\.\d+$/.test(version))
      return { studio: { version, url } };
  }
  throw new Error("GitHub Latest is missing a stable Studio release");
}

async function studioInstaller({ studio, assets }, target) {
  const names = [
    `IntLoom-Studio-${studio.version}-${target.suffix}`,
    `IntLoom-Studio-${target.suffix}`,
  ];
  const base = `${repositoryUrl}/releases/download/app-v${studio.version}/`;
  if (assets) {
    const asset = assets.find(
      (a) => a.state === "uploaded" && names.includes(a.name),
    );
    if (asset && asset.browser_download_url !== base + asset.name)
      throw new Error("Unexpected installer URL");
    return asset?.browser_download_url;
  }
  for (const name of names) {
    const head = await github(base + name, {
      method: "HEAD",
      redirect: "manual",
    });
    if (head.status === 404) continue;
    if (head.status !== 302 && !head.ok)
      throw new Error(`GitHub installer: HTTP ${head.status}`);
    return base + name;
  }
}

async function studioMetadata() {
  const release = await latestStudio();
  const links = await Promise.allSettled(
    studioTargets.map(async (target) => [
      target.id,
      (await studioInstaller(release, target)) ?? null,
    ]),
  );
  return {
    ...release.studio,
    downloads: Object.fromEntries(
      links.flatMap((link) =>
        link.status === "fulfilled" ? [link.value] : [],
      ),
    ),
  };
}

async function cliRelease() {
  const candidates = [];
  for (let page = 1; ; page++) {
    const response = await apiRequest(`${api}?per_page=100&page=${page}`);
    if (!response) return cliFromReleasePage();
    for (const release of await response.json()) {
      const cli = published(release, stableCli);
      if (cli) candidates.push({ ...cli, tag: release.tag_name });
    }
    if (!response.headers.get("link")?.includes('rel="next"')) break;
  }
  for (const { version, url, tag } of candidates.sort(newestFirst)) {
    const compare = await apiRequest(
      `${repoApi}/compare/${encodeURIComponent(tag)}...main?per_page=1`,
      { allowMissing: true },
    );
    if (!compare) return cliFromReleasePage();
    if (compare.status === 404) continue;
    const { status } = await compare.json();
    if (status === "ahead" || status === "identical") return { version, url };
  }
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    const prefix = "/download/studio/";
    if (path !== "/api/releases" && !path.startsWith("/download/"))
      return env.ASSETS.fetch(request);
    if (!["HEAD", "GET"].includes(request.method))
      return new Response(null, {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    const target =
      path.startsWith(prefix) &&
      studioTargets.find((t) => t.id === path.slice(prefix.length));
    if (path !== "/api/releases" && !target)
      return new Response(null, { status: 404 });
    try {
      if (path === "/api/releases") {
        const [cli, desktop] = await Promise.allSettled([
          cliRelease(),
          studioMetadata(),
        ]);
        if (cli.status === "rejected" && desktop.status === "rejected")
          throw cli.reason;
        const metadata = {
          cli: cli.status === "fulfilled" ? cli.value : undefined,
          studio: desktop.status === "fulfilled" ? desktop.value : undefined,
        };
        return new Response(
          request.method === "HEAD" ? null : JSON.stringify(metadata),
          {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=300",
            },
          },
        );
      }
      const destination = await studioInstaller(await latestStudio(), target);
      if (!destination) return new Response(null, { status: 404 });
      return new Response(null, {
        status: 302,
        headers: {
          Location: destination,
          "Cache-Control": "public, max-age=300",
        },
      });
    } catch (error) {
      console.error("Release lookup failed", error.message);
      return new Response(
        request.method === "HEAD"
          ? null
          : `GitHub releases are temporarily unavailable. Visit ${repositoryUrl}/releases/latest`,
        {
          status: 503,
          headers: { "Retry-After": "60", "Cache-Control": "no-store" },
        },
      );
    }
  },
};
