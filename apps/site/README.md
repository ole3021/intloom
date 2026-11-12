# IntLoom website

Use the website to find a Loom and understand what it needs before running it. The Loom directory shows each package's inputs, sample request, expected result and model requirements. Filter by entry type, open a package and copy its terminal command. The command runs on your computer after you install the package.

Run `npx intloom startup` in your terminal to start the local service and observe its activity. The homepage also offers a global CLI install option. Its [meeting-notes walkthrough](pages/en/docs/use/meeting-notes.md) covers installing the Loom, running it on a transcript and exporting the minutes.

The homepage shows the highest stable CLI version whose release tag is on the history of `main`. The version links to the CLI release. **Release notes** opens the repository's [latest GitHub release](https://github.com/ole3021/intloom/releases/latest). The local development server and build preview use the same release lookup as the deployed site. Release responses are cached for five minutes.

The Studio section links each platform directly to its installer on the latest desktop release. It resolves the published GitHub filenames when the page opens, so new releases update the links without a site rebuild. While the release data loads, the fixed `/download/studio/<platform>` links redirect to the corresponding GitHub assets. GitHub serves the installers directly.

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

Run `bun run test` from `apps/site` to start the development server on a temporary port and check its pages and browser scripts. The suite builds and serves the production pages, checks release links and the npm installation instructions, and restarts the development server.

[Website release notes](../../releases/site)

Run the production build followed by `npx wrangler@4.159.0 dev --local` from this directory to test the Worker API and download redirects with the static site.
