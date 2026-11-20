# IntLoom website

This workspace contains a minimal Rspress site with English and Chinese placeholder pages.

```sh
bun run --cwd apps/site dev
bun run --cwd apps/site build
bun run --cwd apps/site typecheck
```

The build writes static assets to `dist/`. Cloudflare configuration is retained for asset hosting; deployment CI is paused.
