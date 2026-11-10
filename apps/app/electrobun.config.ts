import type { ElectrobunConfig } from "electrobun";
import manifest from "./package.json";

export default {
  app: {
    name: "IntLoom Studio",
    identifier: "dev.intloom.studio",
    version: manifest.version,
  },
  release: {
    baseUrl: "https://github.com/ole3021/intloom/releases/latest/download",
    generatePatch: false,
  },
  build: {
    bun: { entrypoint: "src/main/index.ts" },
    mac: {
      codesign: process.env.INTLOOM_SIGN_MAC === "1",
      notarize: process.env.INTLOOM_SIGN_MAC === "1",
      icons: "assets/IntLoom.iconset",
    },
    linux: { icon: "assets/IntLoom.iconset/icon_256x256.png" },
    copy: { dist: "views/studio", ".runtime": "bun/runtime" },
  },
  scripts: { postBuild: "scripts/wrap-launcher.mjs" },
  runtime: { exitOnLastWindowClosed: false },
} satisfies ElectrobunConfig;
