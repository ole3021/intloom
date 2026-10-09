---
title: Installation and project setup
description: Prepare the CLI, initialize an empty project, and install a compatible Workflow package.
---

# Installation and project setup

Published packages require Node.js 22.22.0 or later; the latest Node.js 24 LTS is recommended. Working on this repository and preparing releases requires Node.js 24 or later and Bun 1.4.0 or later. Workflow installation needs npm on `PATH`.

## Use the current source checkout

Before a verified public release is available, build the CLI from the repository root:

```sh
bun install
bun run build --filter=@intloom/cli --concurrency=1
node apps/cli/dist/bin.js --version
node apps/cli/dist/bin.js --help
```

In commands throughout these docs, replace `intloom` with `node /absolute/path/to/intloom/apps/cli/dist/bin.js` when using the source build. Keep that path absolute when changing into a project directory.

## Install a published release

Use this path only when the selected version and its dependencies are available from your registry:

```sh
npm install -g intloom
intloom --version
```

`npm install -g @intloom/cli` provides the same command. Choose one entry. The unscoped package depends on the matching scoped CLI version. Registry publication is separate from building this checkout; a package-not-found error does not indicate a project configuration problem.

## Initialize a project

```sh
intloom init my-project
cd my-project
```

The target must be new or empty, including hidden files. Initialization does not overwrite an existing repository, merge configuration, or start the service. It creates:

```text
my-project/
├── intloom.yaml
├── .gitignore
├── intloom/
│   ├── project/
│   ├── artifacts/
│   └── records/
└── .intloom/
    └── workflows/
```

A business-root `package.json` is not required. To evaluate IntLoom with existing source, use a separate initialized working copy and bring the relevant business files into it. There is currently no in-place initialization mode for a nonempty tree.

## Install a Workflow

Obtain a compiled package from its author. Replace the path below with its actual archive:

```sh
intloom workflow add /absolute/path/to/workflow.tgz
intloom workflow list
```

An archive still needs resolvable runtime dependencies. It does not bundle the SDK or other packages unless its author explicitly packaged them. Before public releases exist, use a local registry or another verified dependency arrangement. Do not assume that copying one archive is sufficient.

Published package names and exact versions are also accepted. You can install during initialization with `intloom init my-project --workflow /absolute/path/to/workflow.tgz`.

Expected result: `workflow list` shows the declared package and installation integrity. Execution names are inspected with `flows` after startup and can differ from npm package names.

Continue with [MCP](./mcp.md) or [CLI](./cli.md). See [Package management](../usage/packages.md) for upgrades and restoration.
