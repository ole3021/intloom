import assert from "node:assert/strict";
import { test } from "node:test";
import { validateAppHtml } from "./apps.ts";
test("self-contained HTML allows bundled inline code and embedded resources", () => {
  validateAppHtml(
    '<html><style>body{background:url(data:image/png;base64,AA)}</style><script type="module">const x = 1;</script><img src="data:image/png;base64,AA"></html>',
    "app.html",
  );
});
test("known external resources and nested browsing contexts are rejected", () => {
  for (const content of [
    '<script src="/main.js"></script>',
    '<link href="https://example.com/style.css" rel="stylesheet">',
    '<style>@import "other.css";</style>',
    '<img src="relative.png">',
    '<iframe src="about:blank"></iframe>',
    '<base href="https://example.com">',
    '<meta http-equiv="refresh" content="0;url=elsewhere">',
    '<script type="module">import "./module.js";</script>',
    '<script>import("https://example.com/script.js")</script>',
  ])
    assert.throws(
      () => validateAppHtml(`<html>${content}</html>`, "app.html"),
      /self-contained/,
    );
});
test("malformed inline JavaScript fails packaging before replacing artifacts", () => {
  assert.throws(
    () =>
      validateAppHtml('<html><script>const x = "</script></html>', "app.html"),
    /invalid inline JavaScript/,
  );
});
