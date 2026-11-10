# Install a local IntLoom candidate

From a source checkout, maintainers can prepare this bundle with Node 26.13.0 and Bun 1.4.4. Run `bun install --frozen-lockfile` and `bun run release:prepare` from the repository root. Enter the exact candidate directory printed under `.release/`. If you received a prepared bundle, start in that directory.

The bundle contains the three framework and two CLI npm archives and two self-contained
Loom archives used in the included Node consumer verification. `candidate.json`
records the platform, runtime versions, archive inventory and SHA-256 values;
`verification.log` records the checks. Only a directory with a verified
`candidate.json` is a completed candidate. A failed preparation retains its log.
These packages have not been published by this procedure.

Use Node `^22.22.0 || ^24.0.0 || ^26.0.0`. The install example uses Bun 1.4.4. In this directory, check file integrity:

```sh
# macOS
shasum -a 256 -c SHA256SUMS
# Linux alternative
sha256sum -c SHA256SUMS
```

Install the included framework packages and their pinned registry dependencies:

```sh
bun install --no-env-file
export PATH="$PWD/node_modules/.bin:$PATH"
```

Continue in the same terminal. The first Run starts the current user’s Intloom service:

```sh
intloom install ./looms/order-total-1.0.0.tgz
intloom run order-total@1.0.0 --input '{"prices":[19,23]}' --plain
intloom install ./looms/reviewed-report-1.0.0.tgz
intloom run reviewed-report@1.0.0 --input '{"title":"Delivery","body":"Ready for review."}' --plain
```

The first Run succeeds with output `42`. The second waits for review (exit 3).
Copy its Run ID and use it below in place of `<runId>`; placeholders are not
literal shell arguments:

```sh
intloom interaction list --run <runId>
intloom artifact list --run <runId>
intloom artifact read <artifactId>
intloom interaction respond <requestId> --value '{"approved":true}'
intloom status <runId> --watch
intloom status <runId>
intloom artifact export <artifactId> --out ./report.md
```

Explicit JSON answers are recorded as `program / cli`. To answer personally in
a terminal, omit `--value` and enter the requested JSON when prompted. The
example permits either source. Approval produces `quality: passed`; rejection
produces `quality: rejected` while execution still succeeds, and observing that
Run returns exit 5. Review is a recorded decision, not an automated assessment
of prose quality. No model credentials or model calls are needed.

`shutdown` lists unfinished Runs and requires confirmation before cancelling them and closing the service. These cancelled Runs cannot resume. Client disconnection leaves waiting Runs intact; unexpected process termination follows explicit recovery rules. Submitting an
answer requests continuation of the existing Run. The draft is not recreated.

The included TypeScript examples can be changed and rebuilt without reinstalling
the framework. Run from this directory so dependencies resolve from its
`node_modules`:

```sh
cd examples/order-total
intloom dev build
intloom loom describe ./dist/order-total-1.0.0.tgz
```

The local `package.json` uses tarball overrides because these exact framework
versions need not exist in a registry. Network access is still needed for
third-party dependencies. Once installed, the example Looms execute without
network access. The bundle is not an offline dependency mirror, a registry
release, a fresh live-model test or a human-client test. Verification on one
platform does not validate another platform; use its own candidate evidence.
