# Repository scripts

These Node.js 26.4.0+ scripts prepare and publish IntLoom packages. They are repository tooling, not CLI runtime code. Bun manages dependencies and Turbo orchestrates workspace tasks.

All IntLoom packages and repository tools require Node.js 26.4.0+. Product and consumer type checks use Node.js 26 types. CI prepares one set of archives, then the reusable consumer workflow tests those exact files on Linux/macOS with minimum Node.js 26.4.0 and latest 26. Both CLI entries are checked on every supported runtime. Each isolated npm installation builds or downloads its own SQLite native binding. Publication waits for this matrix; `verify-published.ts` uses the same matrix after publication.

Release archives, plans, manifests, and generated notes use the repository root's `.release/` directory. No environment variable changes these paths. Packing and validation do not publish packages. E2E workspace candidates are preserved separately inside their execution directories.

## Command entry points

Run commands from the repository root.

`bun run build:dev` builds the CLI and its workspace dependencies, including the Solid TUI transform, then installs a dedicated `intloom-dev` launcher into the directory returned by `bun pm bin -g`. The launcher calls this checkout's `apps/cli/dist/bin.js` with the build's absolute Node executable. It preserves the caller's working directory, arguments, streams, signals and exit status. Rebuilding updates the code used by subsequent commands; changing Node requires rerunning `build:dev`. It neither replaces the published `intloom` command nor starts/stops project Services. This local launcher supports macOS/Linux. Run `bun run build:dev --bin-dir /absolute/bin/directory` to choose a different directory, and add that directory to PATH if needed. Installation refuses to replace unrelated commands, symlinks, or another checkout's launcher; remove the previous launcher explicitly before changing checkouts. To uninstall, remove the printed `intloom-dev` file.

`bun run build` prepares workspace build artifacts without creating release archives. Run `bun run pack` only when archives are needed; Turbo builds the required workspaces first, then runs their separate `pack` scripts. Use `bun run pack --filter=@intloom/cli` to pack one workspace. Packing always runs rather than reusing cached archives, and every archive is written to `.release/`.

| File | Responsibility |
| --- | --- |
| `install-dev-cli.ts` | Install the local development launcher after a successful CLI build. |
| `plan-release.ts` | Select changed or explicitly requested packages and write `.release/plan.json` for CI. |
| `validate-release.ts` | Check the plan's commit, current versions, release channels, and reviewed notes. |
| `pack-package.ts` | Pack one distribution directory; `--selected` dispatches workspace pack tasks from the fixed plan. |
| `release-manifest.ts` | Validate all final archives and write `.release/manifest.json`; `--selected` limits this to the fixed plan. |
| `publish-release.ts` | Publish verified archives only from the enabled main-branch CI workflow, with provenance. |
| `verify-published.ts` | Wait for exact npm versions and matching integrity in both version metadata and install indexes, retry installation propagation races, then verify both command entries, Looms, and storage in temporary directories. |
| `finalize-release.ts` | Create or reuse GitHub releases and attach archives after consumer verification. |

```sh
bun install
bun run pack
node scripts/release-manifest.ts
```

Edit package versions and CHANGELOG entries manually before publication. When updating CLI, give `apps/cli/package.json` and `packages/kernel/package.json` the same version; the generated `intloom` launcher inherits the CLI version. Run `bun install` after version edits to refresh the lockfile. Release preparation uses `bun run pack` to prepare all consumer archives once, then `release-manifest.ts --selected` limits publication to the fixed plan. Publishing does not rebuild archives.

Release planning compares source manifests with `RELEASE_BASE`, a full commit SHA. A package must increase its version when `engines`, `exports`, or production dependencies (`dependencies`, `peerDependencies`, or `optionalDependencies`) change. Workspace dependency ranges are compared at their resolved versions, and the private Kernel participates in the CLI's release unit. Development dependencies, scripts, and object key order do not trigger this guard. A version decrease is always rejected. This metadata guard does not replace review of source or public declaration changes.

Automatic pushes use GitHub's previous commit as the baseline. A first push with GitHub's all-zero baseline selects the initial package versions. Manual workflow dispatch requires the `base` input to identify the reviewed earlier commit; local manual preparation likewise requires `RELEASE_BASE`, alongside `RELEASE_PACKAGES`. Explicit package selection does not bypass metadata checks, and no baseline is inferred from local history.

The local first-publication entry is `bootstrap-release.local.ts`. It is ignored by Git, is not shipped with a checkout, and is not called by CI. Keep it locally when needed and run `node scripts/bootstrap-release.local.ts` against the original CI artifacts. The automatic publisher accepts no bootstrap flag.

npm may acknowledge a publication before its version metadata or install index exposes the new version. Consumer verification retries only absent versions (HTTP 404 or a missing install-index entry), for at most 31 checks at 10-second intervals. A visible version with different integrity, malformed metadata, or another HTTP failure stops verification immediately. Even after both metadata checks pass, npm's next request may still see stale metadata. Local and isolated global consumer installations use `--prefer-online` to revalidate cached metadata and retry `ETARGET` only when npm identifies an exact version in the published entries, for at most 31 installation attempts at 10-second intervals. Missing versions outside those entries, authentication failures, integrity failures, engine mismatches, and lifecycle/build failures are not retried. Integrity errors include the expected and actual hashes; propagation timeout errors identify the packages that are still unavailable and preserve the final npm error when installation fails. Keep the original CI archives and manifest when retrying; rebuilding the same version can produce different archive bytes. Once propagation completes, use **Re-run failed jobs** on the original GitHub Actions run to reuse its reviewed artifacts, then let consumer verification and release finalization complete. This does not require a new package version.

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

Root `check` runs repository-wide Biome validation and workspace type checks. Root `test` uses `test-scripts.ts` to discover and run `scripts/*.spec.ts`, then runs workspace unit tests. The script entry fails when no test files exist and propagates test failures. `test:intg` runs business integration tests; `test:package` consumes archives produced once by its Turbo pack prerequisites. `verify` runs all four checks and validates final archive metadata, without publishing. Tests always execute; builds may restore outputs from cache.

Registry tests use controlled responses to cover propagation retries, integrity conflicts, bounded installation retries and fail-closed handling; they never publish or contact npm. Release tests cover version/channel rules, delivery metadata, CLI release-unit selection and archive identity. Task-graph tests inspect Turbo's resolved dry-run graph for dependency builds, declaration prerequisites, cached output declarations, source tests without their own package build, and uncached integration/package checks. Package-consumer tests separately execute the archives. Release preparation packs all consumer archives once, while `release-manifest.ts --selected` selects the fixed plan for publication.

Local validation does not establish a successful remote publication or OIDC authentication.

### Shared consumer probes

`consumer.mjs` checks the public Compiler/SDK/Intent imports, Loom protocol,
private Kernel isolation and bundled File/SQLite storage. The Intent prepared-archive
consumer test and `verify-published.ts` execute this same probe. `consumer.ts`
also owns the CLI setup probe (init, Loom package management, doctor, start/stop),
which CLI integration tests exercise before publication. Registry visibility,
archive integrity and isolated global installs remain postpublication checks;
local archives do not prove registry availability or real-model completion.


## AI-driven E2E

E2E consumes the local Loom’s existing `dist` and preserves its installed runtime dependency graph as local archives. It does not compile sources or rebuild the CLI.

`intloom e2e [local-loom-path] --root /absolute/e2e-root --case S01` runs the CLI's built-in simulated-user test runner against an already-built local Loom. CMD is the default; `--entry mcp` executes through the external MCP path. Cases, knowledge and required checks live in the Loom project's `e2e/` directory. See [the E2E contract](../apps/cli/src/e2e/README.md) and [Intent examples](../packages/intent/e2e/README.md).

CLI unit and integration tests use a generic probe Loom and controlled local models; they do not depend on Intent cases. Live-provider runs are explicit developer executions and are not part of `verify`. The former root E2E workspace and its CMD/MCP/Codex scripts have been removed.
