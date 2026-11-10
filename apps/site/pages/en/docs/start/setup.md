# Get the 0.4.0 CLI

On macOS or Linux use npm and Node `^22.22.0 || ^24.0.0 || ^26.0.0`. If your configured registry serves the release, run `npm install --global intloom@0.4.0` and check `intloom --version`. For a local build, use the matching candidate.

## Use a local candidate

Enter the candidate directory supplied by your team. It contains `candidate.json`, `SHA256SUMS`, `framework/` and `package.json`. Check it with `shasum -a 256 -c SHA256SUMS` on macOS or `sha256sum -c SHA256SUMS` on Linux. With Bun 1.4.4:

```sh
bun install --no-env-file
export PATH="$PWD/node_modules/.bin:$PATH"
intloom --version
```

Expected version: `0.4.0`. Keep this terminal open. Third-party dependencies require package registry access. A maintainer with a source checkout can prepare the bundle with Node 26.13.0, Bun 1.4.4, `bun install --frozen-lockfile` and `bun run release:prepare` from the repository root. The command prints the candidate directory under `.release/`.

[Run a downloaded Loom](./run) · [Create an author project](./build)
