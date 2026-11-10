# IntLoom website

Use the website to find a Loom and understand what it needs before running it. The Loom directory shows each package's inputs, sample request, expected result and model requirements. Filter by entry type, open a package and copy its terminal command. The command runs on your computer after you install the package.

Install the CLI from npm. The homepage reads stable CLI and Studio releases from GitHub when opened, and links to the four Studio installers. If GitHub is unavailable, the release pages remain accessible. The fixed `/download/studio/<platform>` routes issue HTTP 302 redirects. GitHub serves the installers directly. The website contains no installer files. The meeting-notes guide uses the npm package name `@intloom/meeting-notes`.

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
