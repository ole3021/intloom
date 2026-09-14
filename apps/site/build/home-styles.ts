import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Rspress 2.0 preloads route JavaScript, but not extracted route CSS during SSG.
// Link the homepage chunk before its first paint; the bundler handles navigation.
export async function linkHomeStyles(outDir: string) {
  const cssDir = join(outDir, "static/css/async");
  const files = (await readdir(cssDir)).filter((name) =>
    /^home\.[\da-f]+\.css$/.test(name),
  );
  if (files.length !== 1) {
    throw new Error("Expected one extracted homepage stylesheet.");
  }
  const href = `/static/css/async/${files[0]}`;
  const page = join(outDir, "index.html");
  const html = await readFile(page, "utf8");
  if (!html.includes("</head>")) {
    throw new Error("Homepage HTML is missing its head element.");
  }
  if (html.includes(`href="${href}"`)) return;
  await writeFile(
    page,
    html.replace("</head>", `<link rel="stylesheet" href="${href}"></head>`),
  );
}
