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
| `bun run --cwd apps/site deploy:check` | Validate an existing build with a Wrangler dry run |

Automated tests do not cover styling or browser interaction. After visual changes, inspect the affected pages, keyboard navigation, reduced motion, and narrow layouts. Do not edit generated `dist/` files.

## Visual conventions

The site adapts [Carbon spacing](https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview) and [control specifications](https://www.carbondesignsystem.com/building-blocks/core/components/button/specifications) through its existing components. The IntLoom palette, fonts, page content, and motion remain owned by this workspace; Carbon's default theme and component stylesheet are not imported. Shared spacing and UI type roles live in [tokens.css](./src/styles/tokens.css).

Use named imports from `@carbon/icons-react` for UI icons at 16 or 20 pixels, following [Carbon icon guidance](https://www.carbondesignsystem.com/building-blocks/foundations/icons/guidelines). Label the enclosing control and hide decorative icons from assistive technology. Use a right arrow for internal destinations and an up-right arrow for external destinations. Logos, Canvas effects, Workflow illustrations, and the staged TUI progress animation remain custom artwork.

Controls use 40 or 48 pixel heights, with at least 44 pixel touch targets on narrow screens. Preserve visible keyboard focus and distinguish hover, pressed, and selected states with the site's existing colors. [SiteSearch](./src/components/site-search.tsx) supplies an accessible Carbon search trigger while Rspress owns indexing, results, and shortcuts; [theme/index.tsx](./theme/index.tsx) maps shared document icons to Carbon.

## Deployment

[wrangler.jsonc](./wrangler.jsonc) configures the Worker, static asset directory, workers.dev URLs, and generated 404 handling. The [Website workflow](../../.github/workflows/website.yml) owns website formatting, types, tooling tests, the static build, rendered-page/link tests, and the Wrangler deployment dry run. Package CI and release preparation do not run these website tasks.

Pull Requests validate the merged website without deploying. Pushes to `feat-*` validate and upload a preview with a stable branch alias, independently of package CI. For a feature branch with an open PR, the PR checks the merge result while the push produces the branch preview; neither triggers a second full package CI run.

Production starts only after the `CI` workflow succeeds on `main` (push or manual CI). Both website jobs check out that CI run's exact `head_sha`, build and test the production site, then deploy the same artifact. The deployment gate checks the CI workflow path, repository, source repository, branch, event, conclusion, and exact commit through the GitHub API. It does not use the default-branch `GITHUB_SHA` of a `workflow_run` event as the deployment commit. The Website workflow must exist on the default branch before this automatic trigger can run.

Manual Website runs can rebuild a `feat-*` preview or deploy `main`; manual production still requires successful CI for the exact selected commit. If CI has not succeeded, run CI on `main` first. Tags and other branches cannot deploy. A newer branch commit causes the old deployment to be skipped; API errors or missing CI evidence fail the job.

Before the first deployment, configure `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in GitHub Secrets, then run CI on `main`. Only the upload/deploy step receives these credentials. Production and previews share the same Worker. The production job uses `deploy:production`; previews use `deploy:preview`.

`SITE_CHANNEL=preview` adds `noindex, nofollow` and is included in Turbo cache keys. Preview URLs are not access-controlled.

[deployment-target.mjs](./scripts/deployment-target.mjs) selects the deployment command, enforces the production CI gate, and skips outdated branch commits. [verify-deployment.mjs](./scripts/verify-deployment.mjs) checks page HTTP statuses after deployment and can also check a local Wrangler server through `SITE_URL`. Its summary records `SITE_COMMIT`, the deployed source commit. Verification covers HTTP status only; failure does not roll back uploaded assets.
