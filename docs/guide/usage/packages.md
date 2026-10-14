---
title: Manage Workflow packages
---

# Manage Workflow packages

Workflow installation belongs to the initialized project. Keep the Service stopped while changing packages.

```sh
intloom stop
intloom workflow list
intloom workflow add @intloom/workflow-intent
intloom workflow remove @intloom/workflow-intent
```

The add and remove commands above are separate examples. Add accepts a registry name or a local `.tgz` archive. Bare names select the registry's current version and retain the exact installed identity. Package scripts are disabled.

## Installed package versus loaded Workflow

A package has an npm name/version; its generated Blueprint has a `flowName` such as `intent`. `workflow list` inspects installed packages; after startup, `flows` inspects loaded execution definitions.

Loading checks package metadata, artifact protocol, named ESM exports, resource references, and assets. One unavailable package can report its error while other packages remain available. Inspect the diagnostic phase before reinstalling.

## Preserve restoration inputs

Keep local source archives accessible. IntLoom records archive identity and verifies installation; deleting the original archive can prevent restoration.

Removing a Workflow package retains formal Artifacts and Records. It can make unfinished Run checkpoints impossible to resume. Restore the compatible package before restarting such work.

See [Workflow compatibility](../reference/compatibility.md) and [build your own package](../development/build.md).
