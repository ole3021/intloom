import looms from "./data/looms.json";
import { defineConfig } from "@rspress/core";
import { fileURLToPath } from "node:url";

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
                  "IntLoom Studio",
                  "Download Studio for macOS, Windows and Linux from GitHub Releases.",
                ],
              ]
            : looms.map((loom) => [
                `loom-${loom.name.split("/").at(-1)}`,
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
