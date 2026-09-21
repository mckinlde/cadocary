# Implementation Plan: Corporate Site Positioning

## Overview

This plan implements a content and positioning overhaul **on top of the existing Astro + TypeScript site at `cadocary-site/`** (the prior `website-redesign` implementation). Every task **modifies the existing project in place** — extending the content model, repurposing templates, introducing the Case_Study content type, fixing image correspondence, making the hero legible, removing the blog, and building out Services. Nothing re-architects the build system, routing core, hydrated carousel island, design-token system, or the hand-written JSON-Schema + JSON-LD approach.

The implementation language is **TypeScript** (the existing project language). All paths below are relative to `cadocary-site/`.

Work proceeds bottom-up: schemas and pure domain helpers first (with their property tests), then content documents, then component/page wiring, then blog removal, then final integration. Property tests extend the existing `test/` suite using `fast-check` (≥ 100 iterations, tagged to the design property). The old `project-ordering.property.test.ts` is **migrated** (not weakened) to a case-study ordering property. Deployment is handled separately by the existing GitHub Actions workflow on merge to `main`; no git/deploy tasks are included.

## Tasks

- [x] 1. Establish Case_Study and Service_Offering types and schemas
  - [x] 1.1 Add Case_Study, Service_Offering, and Capability_Statement types
    - In `src/types.ts`, add `CaseStudySection`, `ProofPoint`, `CaseStudy`, `ServiceOffering`, `ServicesPage`, and `CapabilityStatement` types per the design Data Models; extend `Slide` with optional `image` and optional `ref`; extend `Mission` with optional `capability`
    - Remove/replace the old `Project` type usage in favor of `CaseStudy` (keep any shared `ContentBlock` union intact)
    - _Requirements: 4.2, 4.6, 2.4, 3.1, 6.1_

  - [x] 1.2 Author `case-study.schema.ts` (hand-written draft 2020-12)
    - Create `src/schema/case-study.schema.ts`: `name` maxLength 120; `description` maxLength 300; `image.alt` minLength 1 / maxLength 125; `sections` requires each of `problem|approach|whatWasBuilt|outcome` exactly once; `clientSiteUrl` a URL string; required internal keys `id`, `slug`, `order`, `detailPageId`; `engagementRole` and `deliverable` required strings; optional `proofPoints` with `attribution` enum `client|cadocary`
    - Register it in `src/schema/index.ts`
    - _Requirements: 4.2, 4.3, 6.4_

  - [x] 1.3 Author `service.schema.ts` (hand-written draft 2020-12)
    - Create `src/schema/service.schema.ts`: `name` maxLength 120; `description` minLength 80 / maxLength 600; optional `caseStudyRef` string; `offerings` minItems 1 / maxItems 20; required internal keys `id`, `order`
    - Register it in `src/schema/index.ts`
    - _Requirements: 3.1, 3.2_

  - [x] 1.4 Extend product, slide, and mission schemas
    - Extend `src/schema/product.schema.ts` so `image` is the single source of the product picture (`image.alt` 1..125 when present); keep name ≤ 120 and summary ≤ 300
    - Extend `src/schema/slide-deck.schema.ts` to make `image` optional and add optional `ref` (keep the 2–10 slides / 5–8s interval bounds unchanged)
    - Extend `src/schema/mission.schema.ts` with an optional `capability` object (`heading` + `body: ContentBlock[]`)
    - _Requirements: 2.5, 6.2, 6.5, 1.8, 2.6_

  - [x]* 1.5 Write property test for authored-content bounds (extend `validation-bounds.property.test.ts`)
    - **Property 8: Authored content respects declared bounds** — product/case-study/service/alt bounds accepted within limits and rejected when violated
    - **Validates: Requirements 2.5, 3.2, 4.3, 6.4**
    - `fast-check`, ≥ 100 iterations, tagged `Feature: corporate-site-positioning, Property 8`

  - [x]* 1.6 Write property test for services cardinality (extend `validation-bounds.property.test.ts`)
    - **Property 9: Services offering cardinality** — validation accepts 1..20 offerings, rejects 0 or > 20
    - **Validates: Requirements 3.1**
    - `fast-check`, ≥ 100 iterations, tagged `Feature: corporate-site-positioning, Property 9`

- [x] 2. Implement pure image-resolution helper
  - [x] 2.1 Create `src/domain/images.ts` with `resolveImage` and `resolveSlideImage`
    - Implement `resolveImage(input)` returning `{ kind: "image"; src; alt }` or `{ kind: "none" }`; alt falls back to `""` and never exposes a filename/path/placeholder token
    - Implement `resolveSlideImage(slide, byId)` returning the slide's own explicit image when present, otherwise the referenced entity's image, and never any other entity's image
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.6_

  - [x]* 2.2 Write property test for image-content correspondence
    - Create `test/image-correspondence.property.test.ts`
    - **Property 3: Image-content correspondence for products and case studies** — `resolveImage(E)` returns E's own src, never another entity's
    - **Validates: Requirements 6.2, 6.3**
    - `fast-check`, ≥ 100 iterations, tagged `Feature: corporate-site-positioning, Property 3`

  - [x]* 2.3 Write property test for slide image correspondence via reference
    - Add to `test/image-correspondence.property.test.ts`
    - **Property 4: Slide image correspondence via explicit reference** — own explicit image wins, else referenced entity's image, never another entity's
    - **Validates: Requirements 6.1**
    - `fast-check`, ≥ 100 iterations, tagged `Feature: corporate-site-positioning, Property 4`

  - [x]* 2.4 Write property test for graceful image resolution
    - Add to `test/image-correspondence.property.test.ts`
    - **Property 5: Graceful image resolution (missing image and missing alt)** — absent src → `{ kind: "none" }`; present src with missing alt → empty string, never the src/filename/path/token
    - **Validates: Requirements 6.5, 6.6**
    - `fast-check`, ≥ 100 iterations, tagged `Feature: corporate-site-positioning, Property 5`

- [x] 3. Implement case-study ordering and card/JSON-LD derivation for the new types
  - [x] 3.1 Implement date-free case-study ordering in `src/domain/ordering.ts`
    - Add `orderCaseStudies(list)` returning a stable permutation ordered by ascending `order` then ascending `id`, using no publication-date field
    - Keep the existing `orderProducts` behavior intact
    - _Requirements: 4.6_

  - [x]* 3.2 Migrate the project-ordering property test to case-study ordering
    - Create `test/case-study-ordering.property.test.ts` migrated from `test/project-ordering.property.test.ts`, then delete the old file (do NOT weaken the invariant)
    - **Property 11: Case_Study ordering is a date-free stable permutation** — same multiset, deterministic by `order` then `id`, no date field
    - **Validates: Requirements 4.6**
    - `fast-check`, ≥ 100 iterations, tagged `Feature: corporate-site-positioning, Property 11`

  - [x] 3.3 Extend `src/domain/cards.ts` with case-study card view-models and section exposure
    - Add a case-study card view-model exposing title (≤ 120), summary (≤ 300), resolved image (via `resolveImage`, collapsed when none), and a detail link href of exactly `/work/{slug}`
    - Expose the four Case_Study sections in fixed `problem → approach → whatWasBuilt → outcome` order with authored bodies
    - Ensure product, case-study, and service card view-models each expose heading, summary, and CTA
    - _Requirements: 4.3, 4.2, 4.5, 8.6_

  - [x] 3.4 Implement Service_Offering proof-link derivation
    - In `src/domain/cards.ts`, derive a proof link `/work/{slug}` when `caseStudyRef` resolves to an existing case study; omit the link entirely (never empty/broken href) when absent or unresolved
    - _Requirements: 3.7, 3.8_

  - [x] 3.5 Extend `src/domain/json-ld.ts` for Case_Study and Service JSON-LD
    - Emit `@context: "https://schema.org"` and only public fields (`name`, `description`, `image`, `url`); never emit internal bookkeeping (`id`, `slug`, `order`, `detailPageId`, `engagementRole`, `deliverable`)
    - _Requirements: 4.1, 4.3_

  - [x]* 3.6 Write property test for case-study card content and detail link (extend `card-rendering.property.test.ts`)
    - **Property 12: Case_Study card content and detail link** — title ≤ 120, summary ≤ 300, resolved/collapsed image, href exactly `/work/{slug}`
    - **Validates: Requirements 4.3**
    - `fast-check`, ≥ 100 iterations, tagged `Feature: corporate-site-positioning, Property 12`

  - [x]* 3.7 Write property test for every card exposing heading/summary/CTA (extend `card-rendering.property.test.ts`)
    - **Property 13: Every card exposes heading, summary, and call-to-action** — for products, case studies, and service offerings
    - **Validates: Requirements 8.6**
    - `fast-check`, ≥ 100 iterations, tagged `Feature: corporate-site-positioning, Property 13`

  - [x]* 3.8 Write property test for case-study section structure
    - Create `test/case-study-structure.property.test.ts`
    - **Property 10: Case_Study has the four required sections exposed in fixed order** — kinds equal `{problem, approach, whatWasBuilt, outcome}` each once, exposed in fixed order
    - **Validates: Requirements 4.2, 4.5**
    - `fast-check`, ≥ 100 iterations, tagged `Feature: corporate-site-positioning, Property 10`

  - [x]* 3.9 Write property test for Service_Offering proof-link derivation
    - Create `test/services-proof-link.property.test.ts`
    - **Property 14: Service_Offering proof-link derivation** — resolves to `/work/{slug}` when ref resolves; omitted link when absent/unresolved
    - **Validates: Requirements 3.7, 3.8**
    - `fast-check`, ≥ 100 iterations, tagged `Feature: corporate-site-positioning, Property 14`

  - [x]* 3.10 Write property test for JSON-LD public-field emission (extend `json-ld-derivation.property.test.ts`)
    - **Property 21: JSON-LD derivation emits only public Schema.org fields** — public fields only, never internal bookkeeping
    - **Validates: Requirements 4.1, 4.3**
    - `fast-check`, ≥ 100 iterations, tagged `Feature: corporate-site-positioning, Property 21`

- [x] 4. Update the router for the `/work/` case-study family
  - [x] 4.1 Rename the detail prefix constant and result variant in `src/domain/router.ts`
    - Change the project detail prefix constant from `/projects/` to `/work/` and rename the result variant to `kind: "caseStudy"`
    - Keep reserved-path precedence and unknown → not-found behavior unchanged; blog paths become unknown → not-found
    - _Requirements: 4.4, 4.7, 1.7, 3.9, 7.4, 10.4_

  - [x]* 4.2 Write property test for unknown/removed/unavailable → not-found
    - Create `test/work-route.property.test.ts` and extend `test/reserved-path-routing.property.test.ts`
    - **Property 1: Unavailable, removed, or unknown paths resolve to not-found** — includes blog paths and unavailable case-study/collection targets; valid `/work/{slug}` resolves
    - **Validates: Requirements 1.7, 3.9, 4.7, 7.4**
    - `fast-check`, ≥ 100 iterations, tagged `Feature: corporate-site-positioning, Property 1`

  - [x]* 4.3 Write property test for reserved-path precedence (extend `reserved-path-routing.property.test.ts`)
    - **Property 2: Reserved paths resolve to not-found with reason "reserved"** — `/search`, `/login`, `/register` (incl. trailing-slash/query/fragment) checked before any other match
    - **Validates: Requirements 10.4**
    - `fast-check`, ≥ 100 iterations, tagged `Feature: corporate-site-positioning, Property 2`

- [x] 5. Wire the new/renamed content documents into the loader
  - [x] 5.1 Rename `projects` → `caseStudies` and add `services` in `src/domain/content-loader.ts`
    - Update `ContentSource` / `ContentBundle` to rename `projects` → `caseStudies` and add `services`; validate `caseStudies.json` and `services.json` through the existing `validate(doc, schema)` path
    - Keep IA integrity checks (unique id/path, each page in exactly one section, valid `defaultSectionId`, no reserved path) unchanged
    - _Requirements: 4.1, 3.1_

  - [x] 5.2 Author `caseStudies.json` seed content (three fact-grounded case studies)
    - Create `src/content/caseStudies.json` with spendlogic, hotels4truckers, purlpal; each shares the same confirmed `engagementRole` constant (design + implementation consultancy, white-glove end-to-end, better and cheaper at once); per-engagement `deliverable` differs (SpendLogic templating engine; hotels4truckers web + native iOS/Android booking platform; purlpal RAG chatbot over Medicare Advantage plans + webscraping — ORIGINAL RAG framing only, NOT CoachPal)
    - Each has `problem → approach → whatWasBuilt → outcome` sections, `clientName`, `clientSiteUrl` link-out to the live site, explicit `image`, `order`, `slug`, `detailPageId`; client-published metrics use `proofPoints` with `attribution: "client"`
    - _Requirements: 4.1, 4.2, 4.5, 4.6_

  - [x] 5.3 Author `services.json` seed content
    - Create `src/content/services.json` with 1..20 Service_Offering entries positioning Cadocary as a builder of serious custom software (web platforms, native mobile, data pipelines, AI/ML integration, automation), each description 80..600 chars, outcome-focused, no standalone "best"/"world-class"/"cutting-edge"; set `caseStudyRef` where an offering maps to a case study
    - _Requirements: 3.1, 3.2, 3.6, 3.7_

  - [x] 5.4 Update `ia.json`, `products.json`, `slides.json`, and `mission.json` content
    - `ia.json`: remove the `blog` section/pages; rename the projects section to **Work** with `/work/*` paths; keep Products/Services/About; outcome-oriented labels, never "posts"/"articles"
    - `products.json`: set correct images — DocketBot → `/img/case-studies/docketbot-demo.jpg`, ClientCheck → `/img/case-studies/clientcheck-demo.jpg`, Highlighter → `/img/highlighter-screenshot.png`
    - `slides.json`: add explicit `image`/`ref` fixing the DocketBot/ClientCheck mismatch (DocketBot ref `docketbot` → docketbot-demo.jpg; ClientCheck ref `clientcheck` → clientcheck-demo.jpg; tagline and Services slides use their own explicit images)
    - `mission.json`: rewrite to outcome-focused copy and add the optional `capability` block naming ≥ 3 concrete capabilities, anchored to the confirmed consultancy positioning (better AND cheaper, end-to-end)
    - _Requirements: 1.2, 2.2, 2.4, 6.1, 6.2, 7.7, 4.6_

  - [x]* 5.5 Write property test for products/case-studies disjointness
    - Create `test/collection-partition.property.test.ts`
    - **Property 6: Products and case studies are disjoint collections** — product ids and case-study ids are disjoint
    - **Validates: Requirements 2.3**
    - `fast-check`, ≥ 100 iterations, tagged `Feature: corporate-site-positioning, Property 6`

  - [x]* 5.6 Write property test for Capability_Statement capability count
    - Create `test/capability-statement.property.test.ts`
    - **Property 7: Capability_Statement names at least three distinct capabilities**
    - **Validates: Requirements 2.4**
    - `fast-check`, ≥ 100 iterations, tagged `Feature: corporate-site-positioning, Property 7`

  - [x]* 5.7 Write property test for service copy lint (no banned superlatives, no placeholders)
    - Create `test/content-lint.property.test.ts`
    - **Property 19: Service copy contains no banned standalone superlatives** — no standalone "best"/"world-class"/"cutting-edge"
    - **Property 20: Services and Case_Study section copy is real, not placeholder** — non-empty, no "Lorem ipsum"/"TODO"
    - **Validates: Requirements 3.6, 8.5**
    - `fast-check`, ≥ 100 iterations, tagged `Feature: corporate-site-positioning, Property 19` and `Property 20`

- [x] 6. Checkpoint - domain and content layer green
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement hero legibility (transparent gradient banner / scrim)
  - [x] 7.1 Add token-driven overlay scrim and text clamping in `Carousel.astro`
    - Render `.carousel__caption` over a token-driven transparent gradient banner composited between the background image and text; apply identical tokens across all slides (no per-slide overrides)
    - Clamp heading and supporting text to max 3 lines each with trailing ellipsis (`-webkit-line-clamp`), kept within slide bounds and clear of prev/next/dots controls across 320–3840px; use the site typography scale and color tokens
    - Add/extend scrim + overlay tokens in `src/styles/tokens.css`
    - Keep `src/domain/carousel.ts` behavioral logic untouched
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.6_

  - [x] 7.2 Add pure WCAG contrast helper (and optional opacity-stepping function)
    - Create `src/domain/contrast.ts` with a pure WCAG relative-luminance/contrast-ratio helper computing contrast from text and scrim color tokens; add a pure `stepScrimOpacity` function that returns an opacity from ≤ 10% steps (max 100%) achieving a target ratio (or 100% if unreachable), monotonic in steps, never rendering text invisible
    - _Requirements: 5.1, 5.3_

  - [x]* 7.3 Write property test for uniform token-driven overlay
    - Create `test/overlay-legibility.property.test.ts`
    - **Property 16: Overlay treatment is uniform and token-driven across all slides**
    - **Validates: Requirements 5.2, 5.6**
    - `fast-check`, ≥ 100 iterations, tagged `Feature: corporate-site-positioning, Property 16`

  - [x]* 7.4 Write property test for overlay contrast ratio
    - Add to `test/overlay-legibility.property.test.ts`
    - **Property 17: Overlay text meets the required contrast against its backing layer** — ≥ 4.5:1 (≥ 3:1 large/bold) computed from tokens, independent of image
    - **Validates: Requirements 5.1**
    - `fast-check`, ≥ 100 iterations, tagged `Feature: corporate-site-positioning, Property 17`

  - [x]* 7.5 Write property test for opacity stepping
    - Add to `test/overlay-legibility.property.test.ts`
    - **Property 18: Backing-layer opacity stepping reaches the required contrast** — ≤ 10% steps up to 100%, monotonic, achieves target (or 100%), never invisible
    - **Validates: Requirements 5.3**
    - `fast-check`, ≥ 100 iterations, tagged `Feature: corporate-site-positioning, Property 18`

- [x] 8. Implement Hero Section with Capability_Statement and outcome Mission
  - [x] 8.1 Add Capability_Statement and home-section CTAs in `HeroSection.astro`
    - Add an optional `capability?: CapabilityStatement | null` prop; render the Capability_Statement as static, above-the-fold server HTML visible without interaction; render outcome-focused Mission copy
    - Graceful degradation: if capability/mission fails to load, render "temporarily unavailable" placeholder while preserving reserved above-the-fold space
    - Give each home top-level section a heading + intro sentence and a CTA (Services CTA → `/services`, Case Studies CTA → `/work`)
    - _Requirements: 1.1, 1.2, 1.6, 1.8, 2.1, 2.6, 8.3, 9.5, 9.6_

  - [x]* 8.2 Write unit/example tests for the hero
    - Capability_Statement present and visible without interaction (1.1, 2.1); capability-unavailable placeholder preserves reserved space (1.8, 2.6); home CTAs to Services and Case Studies present with labels (9.5, 9.6); section headings + intro copy (8.3)
    - Extend `test/hero-carousel.timing.test.ts` for above-the-fold timing (1.1)
    - _Requirements: 1.1, 1.8, 2.1, 2.6, 8.3, 9.5, 9.6_

- [x] 9. Implement Product Catalog productized labeling and correct images
  - [x] 9.1 Update `ProductCatalog.astro` for productized label and `resolveImage`
    - Present products under a visible "Products"/productized-offerings label distinct from the Case Studies label; render each product's explicitly associated image via `resolveImage` with graceful collapse; keep name ≤ 120 + summary ≤ 300 + CTA
    - _Requirements: 2.2, 2.3, 2.5, 6.2, 6.5, 8.6_

  - [x]* 9.2 Write unit/example tests for product catalog
    - Productized label distinct from case-study label (2.2); correct DocketBot/ClientCheck/Highlighter images (6.2)
    - _Requirements: 2.2, 6.2_

- [x] 10. Implement Case Study Collection and detail pages
  - [x] 10.1 Create `CaseStudyCollection.astro` component
    - Render one card per case study (title ≤ 120, summary ≤ 300, resolved image, link to `/work/{slug}`) via the date-free ordering; no per-item dates/reverse-chron; client-outcome labels, never "posts"/"articles"; present Contact_Path `mailto:mail@cadocary.com`; empty collection → explicit "no case studies are currently available" message
    - _Requirements: 4.1, 4.3, 4.6, 4.8, 9.1, 9.2, 9.4_

  - [x] 10.2 Repurpose the project pages into `/work` index and `/work/[slug]` detail
    - Move/repurpose `src/pages/projects/` to `src/pages/work/`: the index renders `CaseStudyCollection`; `[slug].astro` renders the four sections (Problem → Approach → What was built → Outcome), client name + client-site link-out, proof points labeled as the client's results, and the confirmed `engagementRole` + engagement `deliverable`; emit Case_Study JSON-LD; unavailable detail content stays on page with a message (never blank/broken)
    - Update `getStaticPaths` to build from `caseStudies.json`
    - _Requirements: 4.2, 4.4, 4.5, 4.7, 9.1_

  - [x]* 10.3 Write property test for Contact_Path correctness
    - Create `test/contact-path.property.test.ts`
    - **Property 15: Contact_Path is a correct, readable mailto everywhere it appears** — href exactly `mailto:mail@cadocary.com`, visible text exactly `mail@cadocary.com`
    - **Validates: Requirements 3.5, 9.2, 9.4**
    - `fast-check`, ≥ 100 iterations, tagged `Feature: corporate-site-positioning, Property 15`

  - [x]* 10.4 Write unit/example tests for the case-study collection and detail
    - Three seed case studies present (4.1); empty-state message (4.8); detail-unavailable message (4.7); client metrics attributed to the client and client-site link-out present (4.2, 4.5); extend `test/detail-empty-states.test.ts`
    - _Requirements: 4.1, 4.2, 4.5, 4.7, 4.8_

- [x] 11. Implement the Services page from `services.json`
  - [x] 11.1 Render `services.astro` from the content document
    - Replace the hard-coded pitch block: render 1..20 Service_Offering entries with name + outcome copy; render at least one proof link resolving to the Case_Study_Collection or a specific case study; render per-offering proof link where derived, otherwise no link; present Contact_Path `mailto:mail@cadocary.com` with the literal address as visible text
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 3.8, 9.1, 9.2, 9.4_

  - [x]* 11.2 Write unit/example tests for the services page
    - Proof link present (3.3); Contact_Path present with literal address (3.4, 9.1); offerings render (3.1)
    - _Requirements: 3.1, 3.3, 3.4, 9.1_

- [x] 12. Add Contact_Path to the Footer and apply consistent theming
  - [x] 12.1 Add Contact_Path to `Footer.astro`
    - Render a `mailto:mail@cadocary.com` link whose visible text is the literal address `mail@cadocary.com`; zero blog links (derivation is automatic from the edited IA)
    - _Requirements: 1.5, 9.1, 9.2, 9.4, 7.3_

  - [x] 12.2 Apply/verify shared tokens and card presentation across pages
    - Ensure Home, Services, Product Catalog, and Case_Study_Collection apply identical typography/color/spacing tokens per element type with `var(--token, fallback)` fallbacks; ensure product/case-study/service cards share heading baseline alignment and identical summary/CTA positioning; ensure primary content stays within nav/footer bounds at ≥ 320px
    - _Requirements: 8.1, 8.2, 8.4, 8.6_

  - [x]* 12.3 Write unit tests for theming and token fallbacks (extend `theming.test.ts`)
    - Token application identical across pages; fallback token applied when a token is unavailable; no content overlaps nav/footer
    - _Requirements: 8.1, 8.2, 8.4_

- [x] 13. Remove the blog
  - [x] 13.1 Delete blog files and IA entries
    - Delete `src/content/blog.ts` and `src/pages/blog/`; remove the `blog` section and all blog page entries from `ia.json`; remove any remaining blog references from retained pages, nav, footer, sitemap, and page metadata
    - Confirm nav/footer (IA-derived) drop blog links automatically and previously-existing blog URLs resolve through the router to not-found → 404
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6, 7.7, 7.8_

  - [x]* 13.2 Write blog-removal smoke test
    - Create `test/blog-removal.smoke.test.ts`: `blog.ts` and `src/pages/blog/` absent; no `/blog` routes generate; no `/blog` reference in nav/footer/retained content/sitemap/metadata; IA has no blog section/pages
    - _Requirements: 7.1, 7.6, 7.7, 7.8_

- [x] 14. Checkpoint - components, pages, and blog removal green
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Integration wiring and index page assembly
  - [x] 15.1 Wire `index.astro` and layout to the new content and components
    - Pass `capability` + outcome mission into `HeroSection`; render the productized Product Catalog and the Case Studies section with their CTAs; ensure `CaseStudyCollection`, Services, and Footer all present the Contact_Path; confirm no orphaned imports remain from the removed blog or renamed `projects`
    - _Requirements: 1.3, 1.6, 9.5, 9.6_

  - [x]* 15.2 Update the content-validation smoke test for the new model (extend `content-validation.smoke.test.ts`)
    - Assert `caseStudies.json`, `services.json`, and edited `ia.json`/`products.json`/`slides.json`/`mission.json` pass all schemas + IA integrity; `/work/{slug}` and `/products/{slug}` detail pages stay in sync with the IA; assert every case study carries the shared confirmed `engagementRole`; updated for the renamed `projects → caseStudies` document and the new `services` document
    - _Requirements: 4.1, 3.1, 7.5, 7.7_

  - [x]* 15.3 Update the excluded-features integration test (extend `excluded-features-integration.test.ts`)
    - Zero search/login/registration controls on all pages including the new ones; no auth prompt; `/search`, `/login`, `/register` → not-found
    - _Requirements: 10.1, 10.2, 10.3, 10.5_

- [x] 16. Final checkpoint - typecheck, tests, and build
  - Run `npm run typecheck`, `npm run test`, and `npm run build`; ensure the build succeeds after blog removal and all tests pass. Ask the user if questions arise.
  - _Requirements: 7.5_

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP; core implementation tasks are never optional.
- Each task references specific requirements clauses for traceability.
- Property tests use `fast-check` at ≥ 100 iterations, each tagged `Feature: corporate-site-positioning, Property N: <text>`, extending the existing `test/` suite. The old `project-ordering.property.test.ts` is migrated (Task 3.2), not weakened.
- All work modifies the existing `cadocary-site/` project in place; nothing scaffolds a new project or re-architects the build/router/carousel/token/JSON-LD systems.
- Deployment is handled separately by the existing GitHub Actions workflow on merge to `main`; no git/deploy tasks are included.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["1.5", "1.6", "2.1", "4.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "3.1", "4.2", "4.3", "3.5"] },
    { "id": 4, "tasks": ["3.2", "3.3", "3.4", "5.1", "7.2"] },
    { "id": 5, "tasks": ["3.6", "3.7", "3.8", "3.9", "3.10", "5.2", "5.3", "5.4", "7.1"] },
    { "id": 6, "tasks": ["5.5", "5.6", "5.7", "7.3", "7.4", "7.5", "8.1", "9.1", "10.1"] },
    { "id": 7, "tasks": ["8.2", "9.2", "10.2", "11.1", "12.1", "13.1"] },
    { "id": 8, "tasks": ["10.3", "10.4", "11.2", "12.2", "13.2", "15.1"] },
    { "id": 9, "tasks": ["12.3", "15.2", "15.3"] }
  ]
}
```
