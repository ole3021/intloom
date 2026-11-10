import looms from "./data/looms.json";
import { defineConfig } from "@rspress/core";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { repositoryUrl } from "./src/site.ts";

// The repository tags each package separately, so GitHub's latest release may be a sibling package.
const tags = spawnSync(
  "git",
  [
    "ls-remote",
    "--tags",
    "--refs",
    `${repositoryUrl}.git`,
    "refs/tags/@intloom/cli@*",
    "refs/tags/intloom@*",
  ],
  { encoding: "utf8", timeout: 5000 },
);
const stableTags =
  (tags.status === 0 ? tags.stdout : "").match(
    /(?<=\trefs\/tags\/)(?:@intloom\/cli@|intloom@)\d+\.\d+\.\d+$/gm,
  ) ?? [];
const latest = stableTags
  .map((tag) => ({ tag, version: tag.replace(/^\D+/, "") }))
  .sort((a, b) =>
    b.version.localeCompare(a.version, "en", { numeric: true }),
  )[0];
if (!latest)
  console.warn(
    "No stable IntLoom tag available from GitHub. Linking to the releases list.",
  );

export default defineConfig({
  root: "pages",
  outDir: "dist",
  title: "IntLoom",
  lang: "en",
  locales: [
    {
      lang: "en",
      label: "English",
      description: "Package and run reusable Looms with IntLoom.",
    },
    {
      lang: "zh",
      label: "简体中文",
      description: "使用 IntLoom 开发、分发和运行可复用的 Loom 能力包。",
    },
  ],
  logoHref: "/",
  languageParity: { enabled: true, include: ["docs"] },
  description: "Package, share and run agentic capabilities as Looms.",
  icon: new URL("./assets/favicon.svg", import.meta.url).href,
  route: { cleanUrls: true, localeRedirect: "never" },
  builderConfig: {
    server: { host: "127.0.0.1" },
    dev: { lazyCompilation: false },
    // Rspack can abort when restoring cached developer routes after a page change.
    ...(process.env.NODE_ENV === "development" && {
      performance: { buildCache: false },
    }),
    output: {
      copy: [
        {
          from: fileURLToPath(
            new URL(
              "../../examples/meeting-notes/samples/action.minutes.md",
              import.meta.url,
            ),
          ),
          to: "downloads/0.4.0/meeting-notes-preview.md",
        },
        {
          from: fileURLToPath(
            new URL("../../docs/ai/loom-authoring.md", import.meta.url),
          ),
          to: "downloads/0.4.0/loom-authoring.md",
        },
      ],
    },
    source: {
      define: {
        __INTLOOM_RELEASE__: JSON.stringify(latest ?? null),
      },
    },
  },
  plugins: [
    {
      name: "index-custom-pages",
      modifySearchIndexData(pages) {
        // Rspress extracts Markdown headings automatically; both site pages use JSX.
        for (const page of pages) {
          if (page.routePath !== "/" && page.routePath !== "/looms") continue;
          const home = page.routePath === "/";
          page.title = home ? "IntLoom" : "Loom index";
          const sections: [string, string, string][] = home
            ? [
                [
                  "principle",
                  "The operating principle",
                  "Agents bring intelligence. Looms deliver results.",
                ],
                [
                  "features",
                  "What makes a Loom",
                  "A complete executable capability. Composable execution, flexible orchestration, defined outcomes, managed execution, and reuse across people, applications, and agents.",
                ],
                [
                  "cli",
                  "Install the CLI",
                  "Get started with npm, bun, pnpm or yarn. Check the installed CLI version and run a Loom.",
                ],
                [
                  "author",
                  "Create a Loom",
                  "Build a Loom with your coding agent.",
                ],
                [
                  "client",
                  "IntLoom Client",
                  "Development preview of the local workspace.",
                ],
              ]
            : looms.map((loom) => [
                `loom-${loom.name}-${loom.version}`,
                loom.title,
                [loom.summary, loom.name, loom.kind, ...loom.tags].join(" "),
              ]);
          page.content = "";
          page.toc = sections.map(([id, text, body]) => {
            const charIndex = page.content.length;
            page.content += `\n${body}\n\n`;
            return { id, text, charIndex, depth: 2 };
          });
        }
      },
    },
  ],
  themeConfig: { darkMode: "force-dark" },
});
