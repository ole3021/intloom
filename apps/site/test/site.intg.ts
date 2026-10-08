import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const entries = await readdir(dist, { recursive: true });
const htmlFiles = entries.filter((entry) => entry.endsWith(".html"));
const pages = new Map(
  await Promise.all(
    htmlFiles.map(
      async (entry) =>
        [entry, await readFile(resolve(dist, entry), "utf8")] as const,
    ),
  ),
);

function page(path: string) {
  const html = pages.get(path);
  assert.ok(html, `Missing built page: ${path}`);
  return html;
}

test("the public homepage is statically rendered with one shared navigation", () => {
  const html = page("index.html");
  assert.match(html, /Give your intent/);
  assert.match(html, /a loom of/);
  assert.match(html, /<title>IntLoom — A loom of action<\/title>/);
  assert.equal((html.match(/<header\b/g) ?? []).length, 1);
  assert.equal((html.match(/<main\b/g) ?? []).length, 1);
  if (process.env.SITE_CHANNEL === "preview") assert.match(html, /noindex/);
  else assert.doesNotMatch(html, /noindex/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /role="tabpanel"/);
});

test("docs and supporting pages retain their content inside the shared site frame", () => {
  const docs = page("guide/introduction.html");
  assert.match(docs, /data-site-frame/);
  assert.match(docs, /rp-doc-layout__sidebar/);
  assert.match(docs, /rp-doc-layout__outline/);
  assert.match(docs, /About IntLoom/);
  assert.doesNotMatch(docs, /<canvas/);
  for (const name of ["workflows", "examples"]) {
    const html = page(`${name}.html`);
    assert.match(html, /In development/);
    assert.match(html, /noindex/);
  }
  assert.match(page("404.html"), /Page not found/);
  assert.ok(entries.some((file) => file.startsWith("static/search_index.")));
});

test("every document has a language counterpart and a working switch link", async () => {
  const root = fileURLToPath(new URL("../../../docs/", import.meta.url));
  const englishFiles = (
    await readdir(resolve(root, "guide"), { recursive: true })
  )
    .filter((file) => file.endsWith(".md"))
    .sort();
  const chineseFiles = (
    await readdir(resolve(root, "zh/guide"), { recursive: true })
  )
    .filter((file) => file.endsWith(".md"))
    .sort();
  assert.deepEqual(chineseFiles, englishFiles);
  for (const file of englishFiles) {
    const path = `/guide/${file.replace(/\.md$/, "")}`;
    for (const [prefix, lang, target] of [
      ["", "en", `/zh${path}`],
      ["/zh", "zh", path],
    ] as const) {
      const html = page(`${prefix}${path}.html`.slice(1));
      assert.match(html, new RegExp(`<html[^>]*lang="${lang}"`));
      const link = html.match(/<a\b[^>]*data-language-switch[^>]*>/)?.[0];
      assert.ok(link, `${prefix}${path}: missing language switch`);
      assert.ok(link.includes(`href="${target}"`), `${prefix}${path}: ${link}`);
      assert.match(
        link,
        new RegExp(`hreflang="${lang === "en" ? "zh" : "en"}"`, "i"),
      );
    }
    const english = await readFile(resolve(root, "guide", file), "utf8");
    const chinese = await readFile(resolve(root, "zh/guide", file), "utf8");
    assert.match(chinese, /[\u4e00-\u9fff]/, file);
    const examples = (content: string) =>
      content.match(/^```[^\n]*\n[\s\S]*?^```[ \t]*$/gm) ?? [];
    assert.deepEqual(
      examples(chinese),
      examples(english),
      `${file}: code examples`,
    );
  }
  assert.ok(entries.some((file) => file.startsWith("static/search_index.en.")));
  assert.ok(entries.some((file) => file.startsWith("static/search_index.zh.")));
  assert.doesNotMatch(page("index.html"), /data-language-switch/);
});

test("every rendered internal page link resolves to an emitted artifact", () => {
  for (const [name, html] of pages) {
    assert.doesNotMatch(html, /class="[^"]*\bundefined\b[^"]*"/, name);
    assert.equal((html.match(/<header\b/g) ?? []).length, 1, name);
    for (const [, href] of html.matchAll(/href="([^"#]+)"/g)) {
      if (!href || /^(?:[a-z]+:|\/\/)/i.test(href)) continue;
      const url = new URL(
        href.replaceAll("&amp;", "&"),
        `https://site.test/${name}`,
      );
      const pathname = decodeURIComponent(url.pathname);
      if (
        pathname.startsWith("/static/") ||
        /\.(?:svg|png|ico|css)$/.test(pathname)
      )
        continue;
      const target =
        pathname === "/"
          ? "index.html"
          : `${pathname.replace(/^\//, "").replace(/\/$/, "")}.html`;
      assert.ok(pages.has(target), `${name}: ${href} has no emitted page`);
    }
  }
});
