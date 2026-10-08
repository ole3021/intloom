# Repository scripts

These Node.js 24+ scripts prepare and publish IntLoom packages. They are repository tooling, not CLI runtime code. Bun manages dependencies and Turbo orchestrates workspace tasks.

All archives, release plans, manifests, and generated notes use the repository root's `.release/` directory. No environment variable changes these paths. Packing and validation do not publish packages.

## Command entry points

Run commands from the repository root.

`bun run build` prepares workspace build artifacts without creating release archives. Run `bun run pack` only when archives are needed; Turbo builds the required workspaces first, then runs their separate `pack` scripts. Use `bun run pack --filter=@intloom/cli` to pack one workspace. Packing always runs rather than reusing cached archives, and every archive is written to `.release/`.

| File | Responsibility |
| --- | --- |
| `plan-release.ts` | Select changed or explicitly requested packages and write `.release/plan.json` for CI. |
| `validate-release.ts` | Check the plan's commit, current versions, release channels, and reviewed notes. |
| `pack-package.ts` | Pack one distribution directory; `--selected` dispatches workspace pack tasks from the fixed plan. |
| `release-manifest.ts` | Validate all final archives and write `.release/manifest.json`; `--selected` limits this to the fixed plan. |
| `publish-release.ts` | Publish verified archives only from the enabled main-branch CI workflow, with provenance. |
| `verify-published.ts` | Install exact npm versions in temporary directories and verify both command entries, Workflows, and storage. |
| `finalize-release.ts` | Create or reuse GitHub releases and attach archives after consumer verification. |

```sh
bun install
bun run pack
node scripts/release-manifest.ts
```

Edit package versions and CHANGELOG entries manually before publication. When updating CLI, give `apps/cli/package.json` and `packages/kernel/package.json` the same version; the generated `intloom` launcher inherits the CLI version. Run `bun install` after version edits to refresh the lockfile. CI's selected-package path uses `pack-package.ts --selected` followed by `release-manifest.ts --selected`; it does not rebuild archives during publishing.

The local first-publication entry is `bootstrap-release.local.ts`. It is ignored by Git, is not shipped with a checkout, and is not called by CI. Keep it locally when needed and run `node scripts/bootstrap-release.local.ts` against the original CI artifacts. The automatic publisher accepts no bootstrap flag.

## Shared modules

| File | Responsibility |
| --- | --- |
| `publication.ts` | Public package catalog, source manifests, workspace dependency resolution, and JSON writing. |
| `version.ts` | Version validation, comparison, release channels, and branch/channel rules. |
| `release.ts` | Plan/manifest types and rules, version snapshots, package selection, and release-note validation. |
| `release-files.ts` | Fixed `.release/` paths and validated plan/manifest loading. |
| `archive.ts` | Final tarball contents, publication boundaries, SHA-512 integrity, and pre-publication byte checks. |
| `registry.ts` | npm metadata queries, conflict/dependency checks, partial retries, and archive publication. |
| `github.ts` | GitHub release lookup; only an explicit HTTP 404 means absent. Other failures stop finalization. |

CLI-specific distribution preparation lives in `apps/cli/build/prepare-package.ts`, not in these shared modules. GitHub lookup uses [`gh api --include`](https://cli.github.com/manual/gh_api) to distinguish HTTP status from transport errors.

## Checks

Root `check` retains repository-wide Biome validation. These scripts have no dedicated TypeScript configuration or test suite. Release-time plan, archive, registry, and consumer validation remain in their command entry points.

Local validation does not establish a successful remote publication or OIDC authentication.
