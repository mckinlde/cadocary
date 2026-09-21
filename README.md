# cadocary.com

The source for **cadocary.com** — a content-driven **Astro + TypeScript** static
site, deployed to GitHub Pages.

## Quickstart

```bash
npm ci             # install exact dependencies from package-lock.json
npm run dev        # local dev server
npm run typecheck  # astro check && tsc --noEmit
npm test           # vitest run (property + unit/smoke tests)
npm run build      # astro build → dist/
```

Merging to `main` builds, tests, and deploys to cadocary.com automatically via
GitHub Actions (`.github/workflows/deploy.yml`). The custom domain is preserved
by `public/CNAME`.

## Editing the site

Almost every change is a **JSON edit under `src/content/`** — pages, nav, footer,
cards, and structured data are all derived from it.

- **`ARCHITECTURE.md`** — architecture, structure, invariants, and onboarding.
- **`src/content/README.md`** — step-by-step content-authoring recipes.
- **`.kiro/specs/`** — the requirements / design / tasks specs the site was
  built from (kept for history and future work).

## Disposable / regenerable

These are git-ignored and safe to delete anytime (rebuilt by the commands
above): `node_modules/`, `dist/`, `.astro/`. Cloning the repo and running
`npm ci` reconstructs the full working setup — the machine is disposable.
