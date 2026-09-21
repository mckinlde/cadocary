# Content authoring guide (`src/content/`)

Everything in this folder is **authored content**, validated at build time by the
schemas in `src/schema/` (mirrored by the TypeScript types in `src/types.ts` —
read that file for exact field shapes and length bounds). Edit the JSON here and
the whole site updates: catalogs, detail pages, nav, footer, structured data.

For the big picture, read `../../ARCHITECTURE.md`. This file is the
practical "how do I edit X" reference.

**After any edit, run:** `npm run typecheck && npm test && npm run build`.

---

## Files at a glance

| File | Drives | Detail route |
|------|--------|--------------|
| `ia.json` | Nav bar + footer + site structure | — |
| `products.json` | Products section + `/products` | `/products/{slug}` |
| `caseStudies.json` | Case studies + `/work` | `/work/{slug}` |
| `services.json` | `/services` + home Services preview | — (anchors `/services#{id}`) |
| `slides.json` | Home hero carousel | — |
| `mission.json` | Mission copy + Capability_Statement | — |

`ContentBlock[]` bodies (used in mission, product `body`, case-study sections)
support these block types:
```json
{ "type": "paragraph", "text": "…" }
{ "type": "heading", "level": 2, "text": "…" }   // level 2 | 3 | 4
{ "type": "list", "items": ["…", "…"] }
{ "type": "image", "src": "/img/…", "alt": "…" }
```

---

## Recipe: add a Product

1. Add an entry to `products.json` (see an existing one for the full shape):
   ```json
   {
     "name": "New Product",                 // <= 120 chars
     "description": "One-line summary.",     // <= 300 chars
     "image": "/img/new-product.png",        // put the file in public/img/
     "url": "/products/new-product",
     "pricing": "…", "platform": "…",
     "video": "https://www.youtube.com/embed/VIDEO_ID",  // optional demo
     "download": "https://…",                            // optional trial link
     "body": [ { "type": "heading", "level": 2, "text": "What it does" }, … ],
     "id": "new-product",
     "slug": "new-product",
     "order": 3,
     "detailPageId": "product-new-product"
   }
   ```
2. Add the matching page to the `products` section in `ia.json`:
   ```json
   { "id": "product-new-product", "label": "New Product", "path": "/products/new-product" }
   ```
   The `detailPageId` in the product MUST equal this page's `id`, and `path` MUST
   be `/products/{slug}` (the smoke test checks this).
3. The detail page (`/products/new-product`) is generated automatically from
   `products/[slug].astro`. On the detail page the demo video (if `video` is set)
   renders directly beneath the subtitle, followed by facts, the
   Download/Watch-the-demo buttons, the `body` content, tour, and FAQ.

**External products** (like Highlighter): set `url` to a non-`/products/` path
(e.g. `/highlighter/`). No detail page is generated; the catalog card links out
("Try it live"), and the IA page `path` is that external url.

---

## Recipe: add a Case Study

1. Add an entry to `caseStudies.json`. Required structure:
   - `name` (≤ 120), `description` (≤ 300), `image` `{ src, alt }` (alt 1..125),
     `clientName`, `clientSiteUrl` (link OUT to the live client site).
   - `engagementRole`: **use the exact same shared constant as the other case
     studies** (the confirmed consultancy positioning). The smoke test asserts
     every case study shares one identical `engagementRole`. Copy it verbatim
     from an existing entry; only `deliverable` differs per engagement.
   - `sections`: the four fixed kinds `problem`, `approach`, `whatWasBuilt`,
     `outcome`, each with a `body: ContentBlock[]`. They may be authored in any
     order; the page always renders them problem → approach → whatWasBuilt →
     outcome.
   - `proofPoints` (optional): client-published metrics with
     `"attribution": "client"`. Never attribute client numbers to Cadocary.
   - Internal: `id`, `slug`, `order` (integer, NOT a date), `detailPageId`.
2. Add the matching page to the `work` section in `ia.json`:
   ```json
   { "id": "case-new-client", "label": "New Client", "path": "/work/new-client" }
   ```
   `detailPageId` MUST equal this page's `id`; `path` MUST be `/work/{slug}`.

---

## Recipe: add / edit a Service offering

1. Edit `services.json` (`{ "offerings": ServiceOffering[] }`, 1..20 entries):
   ```json
   {
     "name": "New Service",                       // <= 120 chars
     "description": "Outcome-focused copy …",      // 80..600 chars
     "caseStudyRef": "spendlogic",                 // optional: a caseStudies id
     "id": "new-service",
     "order": 7
   }
   ```
   - If `caseStudyRef` resolves, the card shows a "See the case study →" proof
     link to `/work/{slug}`. If it doesn't resolve, no link is shown (never a
     broken link). One special case: `workflow-automation` links to `/products`
     instead (its proof is Cadocary's own products) — see `services.astro` and
     `ServiceHighlights.astro`.
   - Copy must avoid banned superlatives / placeholders (content-lint enforces).
2. **The home page previews the first 3 offerings by `order`.** To feature a
   specific offering on the home page, give it a low `order`.
3. **To show it in the Services nav dropdown and footer group**, add an anchor
   page to the `services` section in `ia.json`:
   ```json
   { "id": "service-new-service", "label": "New Service", "path": "/services#new-service" }
   ```
   The `services.astro` cards already render `id={offering.id}`, so the anchor
   `/services#new-service` scrolls to the card. (These anchors are how Services
   became a dropdown even though there's a single `/services` route.)

---

## Recipe: edit the hero carousel

Edit `slides.json`. **Array order = display order.** 2..10 slides;
`intervalSeconds` is 5..8.

```json
{
  "id": "slide-x",
  "image": { "src": "/img/…", "alt": "…" },   // OR use "ref" below
  "ref": "docketbot",                          // optional: pull image from a product/case-study id
  "heading": "…",
  "text": "…",
  "cta": { "label": "…", "pageId": "…", "path": "/…" }   // pageId/path should match an ia.json page
}
```

Hero legibility: the caption sits on a solid semi-transparent **scrim banner**
so text stays readable over any image. Its darkness is token-driven — adjust
`--hero-scrim-opacity` / `--hero-scrim-gradient` in `src/styles/tokens.css`
(keep the matching inline fallback in `Carousel.astro` in sync).

---

## Recipe: edit nav / footer / site structure

Edit `ia.json` — the single source of truth. Both nav and footer derive from it.

- A **section** = one top-level nav item + one footer group. Fields: `id`
  (machine), `label` (human-readable), `order`, `pages[]`.
- A section with **1 nav-visible page** → a direct nav **link**.
- A section with **2+ nav-visible pages** → a nav **dropdown** listing those
  pages, and a footer group listing them.
- Per-page visibility: `showInNav` and `showInFooter` (both default `true`). Set
  `showInFooter: false` to keep a page in the nav dropdown but out of the footer,
  etc.
- Rules: `id` and `path` unique across the whole IA; every page in exactly one
  section; `defaultSectionId` must name a real section; never use reserved paths
  (`/search`, `/login`, `/register`).

---

## Recipe: edit the mission / capability copy

Edit `mission.json`:
- `heading` + `body: ContentBlock[]` — the mission copy.
- `capability` (optional): `{ heading, body: ContentBlock[] }` — the
  Capability_Statement. It must name **at least 3 distinct capabilities** (a
  property test checks this). Note: the home hero currently renders the carousel
  only, so mission/capability are not shown on the home hero today, but the
  content and its validation remain in place for reuse.

---

## Gotchas

- **Images** go in `public/img/` and are referenced by absolute path
  (`/img/foo.png`). Give every image meaningful `alt` text (1..125 chars).
- **Don't invent detail routes.** Only `/products/{slug}` and `/work/{slug}` are
  generated. Services offerings are anchors on `/services`, not separate pages.
- **Keep `detailPageId` ↔ `ia.json` page `id` in sync**, and detail `path`s on
  convention — the content-validation smoke test will fail otherwise.
- **The home preview count (3) is separate from the nav/footer count.** If a new
  item isn't showing in the nav dropdown or footer, you probably forgot to add
  its page to the right `ia.json` section.
