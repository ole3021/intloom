# Development and verification

Use Node 26.13.0 and Bun 1.4.4. Bun manages dependencies and runs workspace scripts; library and CLI builds produce Node ESM JavaScript and declarations.

## Commands

| Command | Behavior |
| --- | --- |
| `bun install --frozen-lockfile` | Install the locked dependency graph |
| `bun run clean` | Remove workspace `dist/` outputs |
| `bun run build` | Build framework/app workspaces and all Loom examples through Turborepo |
| `bun run typecheck` | Check workspace sources and TypeScript tooling |
| `bun run check` | Check the development toolchain, Biome and types |
| `bun run test` | Test SDK contracts, Kernel persistence/real Code Runs/tools, Compiler projects, the development launcher and engineering tooling |
| `bun run test:e2e` | Install framework archives, build example Looms, then install/import their archives independently; requires current builds and registry access for third-party dependencies |
| `bun run verify` | Run check, build, test and package-consumption checks |
| `bun run build:dev` | Build the CLI and install the `intloom-dev` development command |

`bun run release:prepare` reports that release preparation is paused and exits unsuccessfully. Release/deployment workflows remain disabled. `Framework CI` runs verification on Linux and macOS, then consumes the same uploaded framework archives on Node 22.22.0, 24.0.0 and 26.0.0. These are engineering checks, not release certification.

On a fresh checkout, prepare the workspace Compiler binary after the first frozen install:

```sh
bun run --cwd packages/loom-sdk build
bun run --cwd packages/compiler build
bun install --frozen-lockfile
bun run verify
```

Bun creates the `intloom-build` workspace links once the declared binary exists. CI uses this same preparation. Subsequent `clean` operations retain those links while removing build output.

## Development CLI

`build:dev` places `intloom-dev` in the directory reported by `bun pm bin -g`. It points to this checkout and the Node executable used during installation. Run it from any directory:

```sh
intloom-dev --help
intloom-dev --version
intloom-dev check examples/code-report
intloom-dev build examples/workflow-report
```

For an isolated launcher, run `bun run build:dev --bin-dir /path/to/bin`. Add that directory to `PATH`. The installer preserves a command owned by another checkout and reports the conflict.

## Application shells

- Browser preview of Studio: `bun run --cwd apps/app dev:web`.
- Native Studio: `bun run --cwd apps/app dev`. Electrobun may need its native platform dependencies.
- Website: `bun run --cwd apps/site dev`.

Studio is a shell without Kernel integration. The website contains static placeholder pages. Its Cloudflare configuration serves `dist/` as static assets.

## Test scope

SDK type checks cover target input/result inference, Zod tool input compatibility, readonly Workflow views, optional skipped results and mode-dependent contexts. Runtime contract tests check schemas and definition construction. Compiler tests exercise valid/invalid projects, transitive definition refresh, resources, graph diagnostics, repeated builds and preservation of prior output on failure.

The npm consumer installs five local framework archives: SDK, Compiler, Kernel, `@intloom/cli` and `intloom`. Third-party runtime dependencies come from npm. It builds all six examples from copied sources, packs the output, installs those Looms in another project and checks imports, callbacks, Zod objects, resource contents and generated TypeScript declaration consumption.

That independent consumer registers prepared installed Looms and executes archived `code-report` in intloom scope plus a separately built workspace variant. It checks real child-process execution, outputs, replay cursors, Store, nested closures, executable Zod answer retries, Node permissions, command authorization, forced cancellation and reopen behavior. Separate data fixtures cover Store isolation, pagination and supplied execution facts. Public-declaration checks cover runtime APIs, Run results, host Store handles and Kernel-owned KV views.

Kernel package tests exercise Run/Exec state, real questions/authorization, both scopes, original input paths, direct Node permission restrictions, explicit environments, ordinary network, cooperative/forced cancellation, managed process cleanup, child/host crashes and explicit interruption finalization. Persistence tests reopen data in another process, exercise SQLite lock failure, migrate v1 history to v2, and inject event/migration failures to verify rollback. Permission-based cleanup-failure tests require a non-root user and are skipped as root.

The installed Hello, Meeting Notes and Intent packages also run deterministic business tests with scripted Agent/user/weather responses. A test-only interpreter evaluates their sequential/nested/repeat definitions using actual Kernel tool scopes. Intent runs real Node.js commands in separate implementation/validation directories for three project sizes, exports candidates and reruns additional assertions. The suite covers evidence precedence, review retries, snapshot handoffs, rejection with complete evidence, input/citation failures and protected files. These scripted checks do not exercise a production Agent or Workflow executor.

Set `INTLOOM_ARCHIVES_DIR` to retain the tested framework archives. Set `INTLOOM_REQUIRE_ARCHIVES=1` with that directory to consume existing archives without Bun or a workspace build. Each archive's SHA-256 is checked before installation. `TURBO_FORCE=true` reruns build and type tasks; test results are not cached by Turbo.

Set `INTLOOM_EXAMPLE_EVIDENCE_DIR` to an absolute directory to retain the three deterministic Intent deliveries (`small/`, `medium/`, `large/`). These contain scripted candidates and real command receipts.

Model calls, production Agent/Workflow execution, native desktop interaction and deployment are outside these checks. Local macOS and Linux/container results should be reported separately, with Node versions and whether archives or workspace builds were consumed. Local checks do not establish that the remote CI matrix or a registry release passed.
