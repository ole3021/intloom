# @intloom/compiler

Use the Compiler when you distribute a Loom or integrate Loom packaging into a build tool. It reads the project's npm metadata and `loom.yaml`, bundles and inspects each declared command, copies declared resources and writes an installable npm archive. Ordinary runtime dependencies stay in the package manifest for npm to install.

## Build an author project

In an author project containing a command manifest and TypeScript entries:

```sh
npm install -D @intloom/compiler @intloom/loom-sdk zod@~4.6.7
npm pkg set scripts.build=intloom-build
npm run build
```

The default output is a `.tgz` in the project's `dist/` directory. Install the archive with `intloom install ./dist/<name>-<version>.tgz`. The [first package tutorial](../../docs/author/first-package.md) includes an example with a concrete archive name.

## Integrate with a build tool

```js
import { buildPackage } from "@intloom/compiler";

const archivePath = await buildPackage("./my-loom", "./artifacts");
console.log(archivePath);
```

`buildPackage` resolves the project and output directories from the calling process. Build on a machine with the author project's dependencies installed. For existing TypeScript `defineLoom` projects, see the [compile, inspect and pack APIs](../../docs/reference/compiler.md).
