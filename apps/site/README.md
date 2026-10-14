# IntLoom website

`intloom-site` is the private Rspress workspace for the IntLoom website and user documentation. It builds a static site for Cloudflare Workers Static Assets, with no server runtime entry, and is not published to npm.

The homepage is `/`. `/workflows` and `/examples` currently contain placeholder pages. English documentation lives under `/guide/`, and Chinese documentation under `/zh/guide/`. The documentation follows eight groups: introduction, getting started, usage, Intent Workflow, concepts/architecture, Workflow development, reference, and help. Each external Agent adapter and each Intent Agent role has its own page. Document pages share the site's navigation, theme, search, and footer, with a link to the same document in the other language.

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

## Visual conventions

The site adapts [Carbon spacing](https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview) and [control specifications](https://www.carbondesignsystem.com/building-blocks/core/components/button/specifications) through its existing components. The IntLoom palette, fonts, page content, and motion remain owned by this workspace; Carbon's default theme and component stylesheet are not imported. Shared spacing and UI type roles live in [tokens.css](./src/styles/tokens.css).

Use named imports from `@carbon/icons-react` for UI icons at 16 or 20 pixels, following [Carbon icon guidance](https://www.carbondesignsystem.com/building-blocks/foundations/icons/guidelines). Label the enclosing control and hide decorative icons from assistive technology. Use a right arrow for internal destinations and an up-right arrow for external destinations. Logos, Canvas effects, Workflow illustrations, and the staged TUI progress animation remain custom artwork.

Controls use 40 or 48 pixel heights, with at least 44 pixel touch targets on narrow screens. Preserve visible keyboard focus and distinguish hover, pressed, and selected states with the site's existing colors. [SiteSearch](./src/components/site-search.tsx) supplies an accessible Carbon search trigger while Rspress owns indexing, results, and shortcuts; [theme/index.tsx](./theme/index.tsx) maps shared document icons to Carbon.

## Deployment

[wrangler.jsonc](./wrangler.jsonc) configures the Worker, static asset directory, workers.dev URLs, and generated 404 handling. [GitHub Actions](../../.github/workflows/ci.yml) checks the repository and deploys the built site: `main` updates production, `feat-*` uploads a preview with a stable branch alias, and Pull Requests run checks only.

Before the first deployment, configure `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in GitHub Secrets, then run CI on `main`. Deployment steps receive these credentials; the site has no business secrets. Production and previews share the same Worker.

`SITE_CHANNEL=preview` adds `noindex, nofollow` and is included in Turbo cache keys. Preview URLs are not access-controlled.

[deployment-target.mjs](./scripts/deployment-target.mjs) selects the deployment command and rejects outdated branch commits. [verify-deployment.mjs](./scripts/verify-deployment.mjs) checks page HTTP statuses after deployment and can also check a local Wrangler server through `SITE_URL`. Verification covers HTTP status only; failure does not roll back uploaded assets.
