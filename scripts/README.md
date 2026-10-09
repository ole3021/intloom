# Repository scripts

These Node.js 24+ scripts prepare and publish IntLoom packages. They are repository tooling, not CLI runtime code. Bun manages dependencies and Turbo orchestrates workspace tasks.

Published products require Node.js 22.22.0+. Repository builds keep Node.js 24 and use Node.js 22 types to constrain product APIs. Consumer verification is the exception to the tooling runtime: the reusable consumer workflow installs repository tools under Node.js 24, then tests built packages on Linux/macOS with Node.js 22.22.0, latest 22, 24, and 26. Each isolated npm installation builds or downloads its own SQLite native binding. Both CI and release preparation run this matrix; publication waits for it to pass. `verify-published.ts` runs on the same runtime matrix after publication.

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
| `verify-published.ts` | Wait for exact npm versions and matching integrity in both version metadata and install indexes, then verify both command entries, Workflows, and storage in temporary directories. |
| `finalize-release.ts` | Create or reuse GitHub releases and attach archives after consumer verification. |

```sh
bun install
bun run pack
node scripts/release-manifest.ts
```

Edit package versions and CHANGELOG entries manually before publication. When updating CLI, give `apps/cli/package.json` and `packages/kernel/package.json` the same version; the generated `intloom` launcher inherits the CLI version. Run `bun install` after version edits to refresh the lockfile. CI's selected-package path uses `pack-package.ts --selected` followed by `release-manifest.ts --selected`; it does not rebuild archives during publishing.

The local first-publication entry is `bootstrap-release.local.ts`. It is ignored by Git, is not shipped with a checkout, and is not called by CI. Keep it locally when needed and run `node scripts/bootstrap-release.local.ts` against the original CI artifacts. The automatic publisher accepts no bootstrap flag.

npm may acknowledge a publication before its version metadata or install index exposes the new version. Consumer verification retries only absent versions (HTTP 404 or a missing install-index entry), for at most 31 checks at 10-second intervals. A visible version with different integrity, malformed metadata, or another HTTP failure stops verification immediately. Integrity errors include the expected and actual hashes; propagation timeout errors identify the packages that are still unavailable. Keep the original CI archives and manifest when retrying; rebuilding the same version can produce different archive bytes. Once propagation completes, use **Re-run failed jobs** on the original GitHub Actions run to reuse its reviewed artifacts, then let consumer verification and release finalization complete. This does not require a new package version.

## Shared modules

| File | Responsibility |
| --- | --- |
| `publication.ts` | Public package catalog, source manifests, workspace dependency resolution, and JSON writing. |
| `version.ts` | Version validation, comparison, release channels, and branch/channel rules. |
| `release.ts` | Plan/manifest types and rules, version snapshots, package selection, and release-note validation. |
| `release-files.ts` | Fixed `.release/` paths and validated plan/manifest loading. |
| `archive.ts` | Final tarball contents, publication boundaries, SHA-512 integrity, and pre-publication byte checks. |
| `registry.ts` | npm metadata queries, bounded publication visibility checks, conflict/dependency checks, partial retries, and archive publication. |
| `github.ts` | GitHub release lookup; only an explicit HTTP 404 means absent. Other failures stop finalization. |

CLI-specific distribution preparation lives in `apps/cli/build/prepare-package.ts`, not in these shared modules. GitHub lookup uses [`gh api --include`](https://cli.github.com/manual/gh_api) to distinguish HTTP status from transport errors.

## Checks

Root `check` runs repository-wide Biome validation, `scripts/*.spec.ts`, and workspace type checks. Registry tests cover delayed visibility in version metadata and install indexes, bounded retries, genuine integrity conflicts, and fail-closed error handling. The task-graph tests inspect Turbo's resolved build, typecheck, unit-test, integration-test, and pack graphs: workspace dependencies must build first, generated self-import declarations must exist before type checking, CLI unit tests must build the public entry used by their shared fixture, and cached builds must restore their outputs. Integration tests and packing must wait for their own builds and always run. These scripts have no dedicated TypeScript configuration; release-time plan, archive, registry, and consumer validation remain in their command entry points.

Local validation does not establish a successful remote publication or OIDC authentication.
