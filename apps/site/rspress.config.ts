import { fileURLToPath } from "node:url";
import { defineConfig } from "@rspress/core";

const isPreview = process.env.SITE_CHANNEL === "preview";

export default defineConfig({
  root: fileURLToPath(new URL("../../docs/", import.meta.url)),
  outDir: "dist",
  title: "intloom",
  description: "intloom 项目介绍与使用文档：从意图出发，连接需求、方案与实现。",
  lang: "zh",
  icon: "/icon.svg",
  logoText: "intloom",
  route: { cleanUrls: true },
  head: isPreview
    ? [["meta", { name: "robots", content: "noindex, nofollow" }]]
    : [],
  themeConfig: {
    socialLinks: [
      {
        icon: "github",
        mode: "link",
        content: "https://github.com/ole3021/intloom",
      },
    ],
    footer: { message: "intloom · 从意图出发，逐步构建。" },
  },
});
