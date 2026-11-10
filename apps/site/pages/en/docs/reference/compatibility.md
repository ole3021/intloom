# Existing compiled-artifact projects

A project that default-exports `defineLoom` in `loom.ts` uses the compiled-artifact authoring path. Its dependency aliases and `loom.lock.json` belong to that format. From the [installed local candidate](../start/setup), try the bundled calculator:

```sh
intloom install ./looms/order-total-*.tgz
intloom run order-total --input '{"prices":[19,23]}' --plain
```

Expected business output: `42`. From `examples/order-total` use `intloom dev build`, `intloom dev test --input '{"prices":[19,23]}' --plain` and `intloom dev publish --dry-run --plain` to build, exercise and preview the compiled archive.

The other bundled example, `reviewed-report`, saves a Markdown draft and records a Workflow review. It permits a program response. For npm Looms, [final delivery confirmation](../use/review) requires a human response. [Start a new npm package](../start/build)
