import { repositoryUrl } from "./src/site.ts";
import {
  cliReleasesUrl,
  studioReleasesUrl,
  studioTargets,
} from "./src/releases.ts";

const api = "https://api.github.com/repos/ole3021/intloom/releases";

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

async function apiRequest(url) {
  const response = await github(url);
  if (
    response.status === 429 ||
    (response.status === 403 &&
      response.headers.get("x-ratelimit-remaining") === "0")
  ) {
    await response.body?.cancel();
    return null;
  }
  if (!response.ok) throw new Error(`GitHub releases: HTTP ${response.status}`);
  return response;
}

// Public release pages remain available when unauthenticated REST reads are throttled.
async function cliFromReleasePage() {
  const page = await github(cliReleasesUrl, {
    headers: { Accept: "text/html", "User-Agent": "intloom-site" },
  });
  if (!page.ok) throw new Error(`GitHub release page: HTTP ${page.status}`);
  let latest;
  let badge;
  const selector = "section[data-release-anchor]";
  const document = new HTMLRewriter()
    .on(selector, {
      element(section) {
        badge = "";
        const tag = section
          .getAttribute("data-release-anchor")
          ?.replace(/^release-/, "");
        const version = stableCli.exec(tag)?.[1];
        section.onEndTag(() => {
          if (
            version &&
            !/pre-release|draft/i.test(badge) &&
            (!latest ||
              version.localeCompare(latest.version, "en", { numeric: true }) >
                0)
          ) {
            latest = {
              version,
              url: `${repositoryUrl}/releases/tag/${encodeURIComponent(tag)}`,
            };
          }
        });
      },
    })
    .on(`${selector} .Label`, {
      text(chunk) {
        badge += chunk.text;
      },
    })
    .transform(page);
  await document.body.pipeTo(new WritableStream());
  return latest;
}

async function latestStudio() {
  const response = await apiRequest(`${api}/latest`);
  if (response) {
    const record = await response.json();
    const studio = published(record, /^app-v(\d+\.\d+\.\d+)$/);
    if (studio && Array.isArray(record.assets))
      return { studio, assets: record.assets };
  } else {
    const page = await github(studioReleasesUrl, {
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

async function cliRelease() {
  let latest;
  for (let page = 1; ; page++) {
    const response = await apiRequest(`${api}?per_page=100&page=${page}`);
    if (!response) return cliFromReleasePage();
    for (const release of await response.json()) {
      const cli = published(release, stableCli);
      if (
        cli &&
        (!latest ||
          cli.version.localeCompare(latest.version, "en", { numeric: true }) >
            0)
      )
        latest = cli;
    }
    if (!response.headers.get("link")?.includes('rel="next"')) return latest;
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
      const { studio, assets } = await latestStudio();
      if (path === "/api/releases") {
        const metadata = { studio, cli: await cliRelease() };
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
      const names = [
        `IntLoom-Studio-${studio.version}-${target.suffix}`,
        `IntLoom-Studio-${target.suffix}`,
      ];
      const base = `${repositoryUrl}/releases/download/app-v${studio.version}/`;
      let destination;
      if (assets) {
        const asset = assets.find(
          (a) => a.state === "uploaded" && names.includes(a.name),
        );
        if (asset && asset.browser_download_url !== base + asset.name)
          throw new Error("Unexpected installer URL");
        destination = asset?.browser_download_url;
      } else {
        for (const name of names) {
          const head = await github(base + name, {
            method: "HEAD",
            redirect: "manual",
          });
          if (head.status === 404) continue;
          if (head.status !== 302 && !head.ok)
            throw new Error(`GitHub installer: HTTP ${head.status}`);
          destination = base + name;
          break;
        }
      }
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
