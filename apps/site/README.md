# IntLoom website

`intloom-site` is the private Rspress workspace for the IntLoom website and user documentation. It builds a static site for Cloudflare Workers Static Assets, with no server runtime entry, and is not published to npm.

The homepage is `/`. `/workflows` and `/examples` currently contain placeholder pages. English documentation lives under `/guide/`, and Chinese documentation under `/zh/guide/`. Document pages share the site's navigation, theme, search, and footer, with a link to the same document in the other language.

## Code organization

- [src/pages/](./src/pages/): route components and page sections; homepage Canvas and SOLVE illustrations live under `home/`.
- [src/components/](./src/components/) and [src/motion/](./src/motion/): shared site components and motion controls.
- [src/styles/](./src/styles/): design tokens and global rules; component styles live beside components as CSS Modules.
- [theme/](./theme/): Rspress adapters and document/search styles. Rspress provides Markdown rendering, sidebar navigation, outline, search, and code highlighting.
- [docs/](../../docs/): English content in `guide/` and Chinese content in `zh/guide/`, with matching page paths and localized `_meta.json` files. [docs/_nav.json](../../docs/_nav.json) is the shared navigation source; [docs-sidebar.ts](./scripts/docs-sidebar.ts) reads each language's page titles and ordering.

Custom page routes are registered in [rspress.config.ts](./rspress.config.ts). Keep the homepage there rather than adding a second `docs/index.md`. Homepage effects stay under `src/pages/home/`; the shared theme must not import them.

## Commands

Run commands from the repository root after installing dependencies. Tool versions and shared conventions are in the [root README](../../README.md) and [AGENTS.md](../../AGENTS.md).

| Command | Purpose |
| --- | --- |
| `bun run dev --filter=intloom-site` | Start the development server |
| `bun run build --filter=intloom-site` | Build static assets in `apps/site/dist/` |
| `bun run typecheck --filter=intloom-site` | Check source, configuration, and tests |
| `bun run test --filter=intloom-site` | Test deployment branch and alias rules |
| `bun run test:intg --filter=intloom-site` | Build, then verify rendered pages and internal links |
| `bun run --cwd apps/site ci:check` | Validate an existing build with a Wrangler dry run |

Automated tests do not cover styling or browser interaction. After visual changes, inspect the affected pages, keyboard navigation, reduced motion, and narrow layouts. Do not edit generated `dist/` files.

## Deployment

[wrangler.jsonc](./wrangler.jsonc) configures the Worker, static asset directory, workers.dev URLs, and generated 404 handling. [GitHub Actions](../../.github/workflows/ci.yml) checks the repository and deploys the built site: `main` updates production, `feat-*` uploads a preview with a stable branch alias, and Pull Requests run checks only.

Before the first deployment, configure `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in GitHub Secrets, then run CI on `main`. Deployment steps receive these credentials; the site has no business secrets. Production and previews share the same Worker.

`SITE_CHANNEL=preview` adds `noindex, nofollow` and is included in Turbo cache keys. Preview URLs are not access-controlled.

[deployment-target.mjs](./scripts/deployment-target.mjs) selects the deployment command and rejects outdated branch commits. [verify-deployment.mjs](./scripts/verify-deployment.mjs) checks page HTTP statuses after deployment and can also check a local Wrangler server through `SITE_URL`. Verification covers HTTP status only; failure does not roll back uploaded assets.
