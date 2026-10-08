import { fileURLToPath } from "node:url";
import { defineConfig } from "@rspress/core";
import navigation from "../../docs/_nav.json";
import { docsSidebar } from "./scripts/docs-sidebar.ts";

const isPreview = process.env.SITE_CHANNEL === "preview";
const docsRoot = fileURLToPath(new URL("../../docs/", import.meta.url));

export default defineConfig({
  root: docsRoot,
  themeDir: fileURLToPath(new URL("./theme/", import.meta.url)),
  outDir: "dist",
  title: "IntLoom",
  description:
    "Carry human intent through agents, code, and explicit decisions. Keep context, execution, and evidence connected.",
  lang: "en",
  locales: [
    { lang: "en", label: "English" },
    { lang: "zh", label: "简体中文" },
  ],
  icon: new URL("./assets/favicon.svg", import.meta.url).href,
  logoText: "IntLoom",
  route: { cleanUrls: true },
  plugins: [
    {
      name: "intloom-site-pages",
      addPages: () =>
        (
          [
            ["/", "home/index"],
            ["/workflows", "workflows"],
            ["/examples", "examples"],
          ] as const
        ).map(([routePath, name]) => ({
          routePath,
          filepath: fileURLToPath(
            new URL(`./src/pages/${name}.tsx`, import.meta.url),
          ),
        })),
    },
  ],
  head: isPreview
    ? [["meta", { name: "robots", content: "noindex, nofollow" }]]
    : [],
  themeConfig: {
    darkMode: "force-dark",
    nav: navigation,
    sidebar: {
      "/guide/": docsSidebar(`${docsRoot}guide`, "/guide"),
      "/zh/guide/": docsSidebar(`${docsRoot}zh/guide`, "/zh/guide"),
    },
  },
});
