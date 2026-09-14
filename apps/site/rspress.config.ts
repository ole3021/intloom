import { fileURLToPath } from "node:url";
import { defineConfig } from "@rspress/core";
import { resolve } from "node:path";
import { linkHomeStyles } from "./build/home-styles";

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
  builderConfig: {
    splitChunks: {
      cacheGroups: {
        homeStyles: {
          name: "home",
          test: /[\\/]components[\\/](?:home|key-visuals)[\\/].*\.css$/,
          chunks: "all",
          minSize: 0,
          priority: 100,
        },
      },
    },
  },
  plugins: [
    {
      name: "intloom-home-styles",
      async afterBuild(config, isProd) {
        if (isProd)
          await linkHomeStyles(
            resolve(
              fileURLToPath(new URL(".", import.meta.url)),
              config.outDir ?? "dist",
            ),
          );
      },
    },
  ],
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
