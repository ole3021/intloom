# IntLoom website

Use the website to find a Loom and understand what it needs before running it. The Loom directory shows each package's inputs, sample request, expected result and model requirements. Filter by entry type, open a package and copy its terminal command. The command runs on your computer after you install the package.

The 0.4.0 guides take a user from a downloadable file-report archive to an exported text file. Authors scaffold a greeting package and install it in a separate npm project. Both languages also link to the same standalone Markdown guide for coding agents. The website serves the [sample archive](pages/public/downloads/0.4.0/file-report-0.4.0.tgz) and copies the [versioned authoring guide](../../docs/ai/loom-authoring.md) into its downloads at build time.

The directory also offers [meeting-notes](pages/en/docs/use/meeting-notes.md), an official model-backed Loom with an installable archive and a Chinese usage guide.

- [English guides](pages/en/docs/index.md)
- [Simplified Chinese guides](pages/zh/docs/index.md)
- [Packages listed in the directory](data/looms.json)

## Preview the website

Install dependencies from the repository root, then start the site from its own directory:

```sh
bun install --frozen-lockfile
cd apps/site
bun run dev
```

Open the local URL printed by the server (normally `http://127.0.0.1:3000/`). Visit `/looms` for the directory, `/docs/` for English and `/zh/docs/` for Chinese. To inspect a production build from `apps/site`, run `bun run build` followed by `bun run preview`.

Run `bun run test` from `apps/site` to start the development server on a temporary port and check its pages and browser scripts. The suite builds and serves the production pages, compares the downloads with their sources, and restarts the development server.

[Website release notes](../../releases/site)
