import { defineConfig } from "@rspress/core";

export default defineConfig({
  root: "pages",
  outDir: "dist",
  title: "IntLoom",
  lang: "en",
  locales: [
    { lang: "en", label: "English" },
    { lang: "zh", label: "简体中文" },
  ],
  icon: new URL("./assets/favicon.svg", import.meta.url).href,
  route: { cleanUrls: true, localeRedirect: "never" },
  builderConfig: { server: { host: "127.0.0.1" } },
});
