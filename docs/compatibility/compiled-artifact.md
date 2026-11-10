# Maintain a compiled-artifact project

Check the project before choosing a command. The older author format default-exports `defineLoom({ id, version, entry, ... })` from `loom.ts`. Its artifact manifest, locked Loom dependencies and service catalog are part of that format. The local candidate includes two such examples, `order-total` and `reviewed-report`.

From the [installed candidate directory](../maintainers/candidate.md), build and inspect the calculator:

```sh
cd examples/order-total
intloom dev build
intloom loom describe ./dist/order-total-1.0.0.tgz
intloom dev test --input '{"prices":[19,23]}' --plain
intloom dev publish --dry-run --plain
```

The test returns 42. The dry run previews the archive identity and target registry. These projects can use `loom.lock.json`, `dev build --update` and the [compile and pack APIs](../reference/compiler.md). Their workflow-specific acceptance policy can permit a program response. See [the candidate walkthrough](../maintainers/candidate.md) for the review example.

For a new npm Loom, start with [the 0.4.0 author project](../author/first-package.md). Its `loom.yaml` declares one or more commands, its npm build script invokes `intloom-build`, and its recipient installs the resulting archive with `intloom install`.
