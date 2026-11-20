# IntLoom Studio

This workspace contains a minimal Electrobun desktop shell with a React view, Vite build and Tailwind setup. It displays a placeholder page without starting a Kernel service.

```sh
bun run --cwd apps/app dev:web
bun run --cwd apps/app build
bun run --cwd apps/app typecheck
```

Use `bun run --cwd apps/app dev` for native development. The retained desktop build scripts require Electrobun's platform dependencies. Release CI is paused.
