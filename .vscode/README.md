# Editor configuration

VS Code and Cursor share this directory's workspace settings. Open the repository root, run `bun install`, and install the recommended `biomejs.biome` extension. Reload the editor after installing it.

`settings.json` leaves `biome.lsp.bin` empty so the extension resolves the repository-installed Biome dependency automatically, including Bun's isolated dependency layout. Run `bun install` before opening files so the extension uses the project version rather than a global fallback. `biome.configurationPath` selects the root `biome.json`, which remains the single source of formatting, lint rules, and file exclusions; do not duplicate those rules in editor settings.

Saving JavaScript, TypeScript, JSX/TSX, JSON/JSONC, CSS, or GraphQL formats the whole file, matching `bun run format` for that file. Markdown, MDX, and YAML are not formatted automatically. Lint diagnostics use the same Biome rules as `bun run lint`. Save-time lint fixes and import organization are disabled because `format` does neither; ESLint and Prettier are disabled for this workspace to avoid conflicting checks or formatting.

`extensions.json` recommends the [official Biome extension](https://biomejs.dev/reference/vscode/); it does not install extensions automatically. IDE diagnostics cover the files being edited, not full-repository validation. Run `bun run check` for repository-wide formatting, lint, and TypeScript validation.
