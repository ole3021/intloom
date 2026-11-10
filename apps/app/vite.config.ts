import tailwind from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  plugins: [tailwind()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src/view/", import.meta.url)) },
  },
  build: { outDir: "dist", target: "safari17" },
});
