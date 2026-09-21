# cadocary.com — Architecture & Onboarding

This is the source for **cadocary.com**: a content-driven **Astro + TypeScript**
static site. This document is the fast-onboarding guide for anyone (human or
agent) adding or editing content. Read this first.

> TL;DR: **Content lives in JSON under `src/content/`.** Almost every change you'll
> be asked to make is a JSON edit. The pages/components derive everything from
> that JSON. Validate with `npm run typecheck && npm test && npm run build`, then
> merge to `main` — GitHub Actions deploys to cadocary.com automatically.

---

## 1. The 30-second mental model

```
src/content/*.json   →   src/schema/* (validate)   →   src/domain/* (pure logic)
   (what you edit)          + src/types.ts               (ordering, cards,
                                                           routing, nav/footer,
                                                           images, JSON-LD)
                                        │
                                        ▼
                          src/components/*.astro  +  src/pages/*.astro
                                   (presentation, static HTML)
                                        │
                                        ▼
                          astro build  →  dist/  →  GitHub Pages (cadocary.com)
```

- **Static-first.** Every page is pre-rendered to plain HTML at build time and
  ships **zero client-side JavaScript**, with ONE exception: the hero
  `Carousel` is a hydrated island (it needs a timer + interaction).
- **Content is the single source of truth.** Nav, footer, routes, cards,
  structured data (JSON-LD), and the home-page sections are all *derived* from
  the JSON in `src/content/`. You rarely touch `.astro` files for content edits.
- **The IA (`ia.json`) is the single source of truth for site structure.** The
  navigation bar and the footer are both derived from it — they cannot drift out
  of sync.

---

## 2. Directory map

```
src/
  content/        ← AUTHORED CONTENT (JSON). This is what you edit most.
    ia.json           Information Architecture: sections + pages → nav & footer
    products.json     Cadocary's own products (DocketBot, ClientCheck, Highlighter)
    caseStudies.json  Client engagements presented as case studies (/work/{slug})
    services.json     Service offerings shown on /services
    slides.json       Hero carousel slides (home page)
    mission.json      Mission copy + optional Capability_Statement
    README.md         ← Content authoring recipes (edit-this-file guide)

  schema/         ← Hand-written JSON Schema (draft 2020-12) validators
    *.schema.ts       One per content doc; enforce field bounds/shape
    index.ts          Re-exports all schemas
    validator.ts, json-schema.ts   The tiny hand-rolled validator core

  types.ts        ← TypeScript mirror of the schemas (READ THIS for field shapes)

  domain/         ← Pure, testable logic (no DOM, no Astro). One concern each:
    content-loader.ts   Loads + validates all content, runs IA integrity checks
    ia-derivation.ts    buildNavModel / buildFooterDirectory / getActiveSection
    router.ts           resolveRoute(path) → page | product | caseStudy | not-found
    ordering.ts         orderProducts / orderCaseStudies (stable, date-free)
    cards.ts            productCard / caseStudyCard / serviceOfferingCard view-models
    images.ts           resolveImage / resolveSlideImage (graceful, correspondence)
    json-ld.ts          Schema.org JSON-LD emission (public fields only)
    contrast.ts         WCAG contrast helpers for the hero scrim
    capability.ts       Capability_Statement helpers
    content-lint.ts     Copy lint (banned superlatives, placeholder detection)
    carousel.ts         Pure carousel state transitions (advance/goTo/sequence)
    nav-state.ts        Pure nav open/close reducer

  components/     ← Presentation (.astro). Static HTML from derived models.
    Layout is in src/layouts/Layout.astro (shared shell: nav + footer + <head>)
    NavigationBar.astro, Footer.astro         (derived from ia.json)
    HeroSection.astro, Carousel.astro         (home hero; Carousel is hydrated)
    ProductCatalog.astro                      (Products section / catalog)
    ServiceHighlights.astro                   (home Services preview)
    CaseStudyCollection.astro                 (Case studies grid; home + /work)
    ContentBody.astro                         (renders ContentBlock[] arrays)

  pages/          ← Routes (file-based). Thin: they wire content into components.
    index.astro                 /            (home: hero + 3 sections)
    services.astro              /services    (full services list)
    contact.astro               /contact
    404.astro                   /404
    products/[slug].astro       /products/{slug}   (getStaticPaths from products.json)
    products/index.astro        /products
    work/[slug].astro           /work/{slug}       (getStaticPaths from caseStudies.json)
    work/index.astro            /work

  styles/
    tokens.css      ← Design tokens (colors, spacing, type scale, hero scrim).
                      Single source of truth for theming; components use
                      var(--token, fallback).
    global.css      Imports tokens.css + base element styles.

public/            ← Static passthrough assets, copied verbatim to dist/.
    img/            Screenshots used by content (products, case studies, slides).
    CNAME           cadocary.com (custom domain — do not remove).
    highlighter/    Prebuilt Highlighter app (carried over as-is).
    docketbot/      Legacy Stripe success/cancel redirect pages (keep working).

test/              ← Vitest suite: property tests (fast-check) + unit/smoke.
.github/workflows/deploy.yml   ← Build + test + deploy to GitHub Pages on push to main.
```

---

## 3. How content flows to the page (why you rarely edit .astro)

1. You edit a JSON file in `src/content/`.
2. `src/domain/content-loader.ts` validates it against its schema
   (`src/schema/`) and runs cross-document **IA integrity checks** (unique
   ids/paths, every page in exactly one section, valid `defaultSectionId`, no
   reserved path). A build-time smoke test (`test/content-validation.smoke.test.ts`)
   fails the build if content is invalid.
3. Pure `domain/` functions derive the view models: ordering, card contents,
   nav/footer models, resolved images, JSON-LD.
4. `.astro` components render those models to static HTML. The shared
   `Layout.astro` wraps every page with the nav, footer, and `<head>` metadata.

Because of this, **adding a product / case study / service / slide is a JSON
edit** — the catalog, detail page, nav dropdown, footer group, sitemap-ish
structure, and structured data all update automatically.

---

## 4. Key invariants (don't break these)

- **IA is the single source of truth for nav + footer.** Never hand-author nav
  or footer links. Edit `ia.json`; both update. A section with 1 nav-visible
  page becomes a direct link; a section with 2+ becomes a **dropdown**.
- **Page `id` and `path` are unique across the whole IA.** Duplicates fail the
  integrity check (and the build).
- **Reserved paths** `/search`, `/login`, `/register` must never appear in the
  IA. The site intentionally has **no search / login / registration / forms**.
- **Products vs. Case Studies are distinct collections.** Products = Cadocary's
  own productized software (`/products/{slug}`). Case Studies = client
  engagements (`/work/{slug}`). Keep their ids disjoint.
- **Ordering is date-free.** Both products and case studies order by the integer
  `order` field, tie-broken by `id`. There are no publication dates.
- **Images show their OWN entity.** Each product/case study/slide references its
  own image; `resolveImage`/`resolveSlideImage` guarantee no cross-wiring and
  collapse gracefully when an image is missing (never a broken `<img>`).
- **JSON-LD emits public Schema.org fields only** (`name`, `description`,
  `image`, `url`) — never internal bookkeeping (`id`, `slug`, `order`, etc.).
- **Client metrics are attributed to the client.** Case-study `proofPoints` use
  `attribution: "client"` for client-published numbers — never claim them as
  Cadocary's own.
- **Theming goes through tokens.** Use `var(--token, fallback)` from
  `tokens.css`; don't hard-code colors/spacing in components.
- **Copy lint.** Avoid standalone superlatives ("best", "world-class",
  "cutting-edge") and placeholder text ("Lorem ipsum", "TODO") in service /
  case-study copy — `content-lint` property tests enforce this.

---

## 5. Home page composition (`src/pages/index.astro`)

The home page is a hero **carousel only** (no capability/mission bubbles),
followed by three consistent top-level sections. Each section shows a heading, a
short intro, a capped **preview** of example "bubbles", and a **"See all →"**
link to its full detail page:

| Section      | Component                 | Preview cap | See-all → |
|--------------|---------------------------|-------------|-----------|
| Products     | `ProductCatalog`          | 3           | `/products` |
| Services     | `ServiceHighlights`       | 3           | `/services` |
| Case Studies | `CaseStudyCollection`     | 3           | `/work` |

The preview cap (`HOME_PREVIEW_LIMIT = 3`) is applied on the home page only via
a `limit` prop. The **full lists** live on the section detail pages. The
nav dropdown and footer show the full set of pages from `ia.json` (independent of
the home preview) — so "how many appear in the footer/dropdown" is controlled by
`ia.json`, NOT by the home page.

---

## 6. Build, test, deploy

```bash
npm install
npm run dev        # local dev server (do not rely on this in CI/agents)
npm run typecheck  # astro check && tsc --noEmit  (must be 0 errors)
npm test           # vitest run — property + unit/smoke tests
npm run build      # astro build → dist/  (must succeed)
```

**Always run `npm run typecheck && npm test && npm run build` before shipping.**
The GitHub Actions workflow (`.github/workflows/deploy.yml`) runs the same three
on every push to `main`, then deploys `dist/` to GitHub Pages. **Merging to
`main` deploys to cadocary.com** — there is no separate deploy step. The custom
domain is preserved by `public/CNAME`.

Note: `astro check` prints benign `[content] … must live in a content/…
subdirectory` warnings for the JSON files (they intentionally live in
`src/content/`, not an Astro content collection). These are informational; the
check still reports 0 errors.

---

## 7. Where to make common changes

See `src/content/README.md` for step-by-step content recipes. Quick index:

- **Change wording on a page** → the relevant `src/content/*.json`, or the
  component's lede text if it's structural copy (e.g. `ProductCatalog.astro`
  intro). Grep the phrase to find it.
- **Add/edit a product** → `products.json` (+ an `ia.json` page under the
  `products` section). Detail page is generated automatically.
- **Add/edit a case study** → `caseStudies.json` (+ an `ia.json` page under the
  `work` section).
- **Add/edit a service** → `services.json` (+ optionally an `ia.json` anchor
  page under the `services` section so it shows in the nav dropdown/footer).
- **Reorder anything** → change the `order` integer.
- **Hero carousel slides** → `slides.json` (array order = display order).
- **Nav / footer structure** → `ia.json`.
- **Colors / spacing / hero scrim darkness** → `src/styles/tokens.css`.

---

## 8. Testing philosophy (so you know what will gate your change)

- **Property-based tests** (`fast-check`, ≥ 100 iterations) cover the pure
  `domain/` logic: routing, ordering, nav/footer derivation, image
  correspondence, card contents, contrast, copy lint, JSON-LD.
- **Unit/example + smoke tests** cover components (via source/DOM assertions),
  content validation, blog-removal, and an **integration test that runs a real
  `astro build` and scans the generated HTML** for excluded features and the
  home composition.
- If you change content shape or structure, the smoke/integration tests are the
  ones most likely to need updating alongside — keep them in sync with reality.
