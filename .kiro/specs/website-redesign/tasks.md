# Implementation Plan: Website Redesign

## Overview

This plan implements the website redesign as an **Astro + TypeScript** application. The site is content-driven: products, projects, hero slides, mission copy, and the Information Architecture (IA) all live in validated JSON. The domain layer is a set of pure functions (nav/footer derivation, ordering, carousel state, slide sequencing, route resolution, JSON-LD emission) that are property-tested with **fast-check**. The presentation layer is static/server-rendered Astro, with the **hero carousel implemented as a hydrated island** (the only client-interactive component). Content is validated by a **hand-written JSON Schema (draft 2020-12) validator** — a deliberate choice, not a third-party library.

Implementation proceeds bottom-up: types → schemas + own validator → pure domain functions (with property tests co-located) → JSON-LD emission → Astro presentation components → routing → global theming → integration wiring.

Throughout, wherever a notable technology or design decision was made, tasks require **code comments explaining the choice and its advantages/rationale** (Astro + TypeScript with selective hydration, the own draft 2020-12 validator, Schema.org alignment + JSON-LD, and the single-source-of-truth IA driving nav and footer).

## Tasks

- [x] 1. Set up Astro + TypeScript project structure and shared types
  - [x] 1.1 Initialize the project and define shared types
    - Initialize an Astro project with TypeScript (strict) and configure the test runner (Vitest) plus fast-check as a dev dependency
    - Create directory structure: `src/content/` (JSON), `src/schema/` (JSON Schema docs + validator), `src/domain/` (pure functions), `src/components/` (Astro components + carousel island), `src/pages/` (routes), `src/styles/` (design tokens), `test/`
    - Define shared TypeScript types mirroring the Data Models: `IA`, `Section`, `PageRef`, `Product`, `Project`, `Slide`, `SlideDeck`, `Mission`, `ContentBlock`, and the derived `NavModel`, `NavItem`, `NavLink`, `FooterDirectory`, `FooterGroup`, `FooterLink`, `CarouselState`, `JsonLd`
    - Add a top-level architecture comment (e.g. in an `architecture.ts` doc comment) explaining the **Astro + TypeScript static-first with selective hydration** decision: the site is server-rendered/static for speed and SEO, and only the carousel is a hydrated island for interactivity — documenting the advantage of shipping minimal client JS
    - _Requirements: 9.1_

- [x] 2. Author JSON Schemas and implement the own draft 2020-12 validator
  - [x] 2.1 Author JSON Schema (draft 2020-12) documents for every content entity
    - Write draft 2020-12 schema documents for `IA`, `Product`, `Project`, `SlideDeck`, `Mission`, and `ContentBlock`, each declaring `"$schema": "https://json-schema.org/draft/2020-12/schema"`
    - Encode all declared bounds: slide deck length 2..10, `intervalSeconds` 5..8, product/project `name` maxLength 120, `description` maxLength 300; required fields for each type
    - Encode IA constraints expressible in schema (required fields, string patterns for paths); cross-document constraints (uniqueness, single-section, reserved-path exclusion) are enforced in domain validation (task 3.1)
    - _Requirements: 3.3, 3.4, 5.2, 6.2_
  - [x] 2.2 Implement the hand-written JSON Schema draft 2020-12 validator
    - Implement `validate(doc, schema): Result<T, ValidationError>` supporting the draft 2020-12 keywords used by our schemas (`type`, `required`, `properties`, `maxLength`, `minItems`/`maxItems`, `minimum`/`maximum`, `enum`, `items`, `oneOf` for `ContentBlock`)
    - Produce tailored, path-aware error reporting (which field/index failed and why)
    - Add a header comment in the validator module documenting the deliberate decision to **implement our own draft 2020-12 validator instead of a third-party library**, with rationale: full control over validation behavior, no extra runtime dependency, and tailored error messages aligned to our content model
    - _Requirements: 3.3, 3.4, 5.2, 6.2_
  - [x]* 2.3 Write property test for content validation bounds
    - **Property 9: Content validation enforces all declared bounds**
    - **Validates: Requirements 3.3, 3.4, 5.2, 6.2**
    - Use generators producing in-bounds and over-bounds slide-deck lengths, intervals, and name/description lengths; assert accept iff all bounds hold; min 100 iterations; tag `Feature: website-redesign, Property 9`

- [x] 3. Implement Content Loader and IA cross-document validation
  - [x] 3.1 Implement content loading and IA integrity checks
    - Implement `loadContent(source): Result<ContentBundle, ContentError>` that fetches each JSON document and runs it through the own validator (task 2.2)
    - Enforce cross-document IA constraints in code: unique `PageRef.id` and unique `path` across the whole IA, each page in exactly one section, `defaultSectionId` references an existing section, and no `path` equals a reserved path (`/search`, `/login`, `/register`)
    - Fail loudly in development; surface `ContentError` for production fallback handling
    - _Requirements: 2.2, 2.6, 8.5_
  - [x]* 3.2 Write property test for the single-section invariant
    - **Property 3: Every page belongs to exactly one section**
    - **Validates: Requirements 2.2**
    - Use the IA generator; assert each page id appears in exactly one section's page list; min 100 iterations; tag `Feature: website-redesign, Property 3`

- [x] 4. Implement IA-derived navigation and footer (single source of truth)
  - [x] 4.1 Implement `buildNavModel` and `buildFooterDirectory`
    - Implement `buildNavModel(ia)`: nav-visible sections → one-to-one nav items preserving section order; single nav-visible page → `link` item; two or more → `menu` item with those children
    - Implement `buildFooterDirectory(ia)`: one labeled group per section using the human-readable `label`, each footer-visible page appearing exactly once in its owning section's group
    - Add a header comment in this derivation module documenting the **single-source-of-truth IA** decision: both nav and footer are derived from the same `ia.json`, so they cannot drift out of sync — adding/removing a page updates both automatically
    - _Requirements: 1.2, 2.1, 2.5, 7.2, 7.3, 7.4, 7.7, 7.8_
  - [x] 4.2 Implement active-section computation
    - Implement a pure function that, given the IA and a current page, returns the owning top-level section (used for the persistent current-section indicator)
    - _Requirements: 1.7_
  - [x]* 4.3 Write property test for navigation derivation
    - **Property 1: Navigation derivation mirrors the Information Architecture**
    - **Validates: Requirements 1.2, 2.1, 2.5**
    - Min 100 iterations; tag `Feature: website-redesign, Property 1`
  - [x]* 4.4 Write property test for footer derivation
    - **Property 2: Footer directory mirrors the Information Architecture**
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.7, 7.8**
    - Min 100 iterations; tag `Feature: website-redesign, Property 2`
  - [x]* 4.5 Write property test for active-section computation
    - **Property 5: Active-section computation matches the owning section**
    - **Validates: Requirements 1.7**
    - Min 100 iterations; tag `Feature: website-redesign, Property 5`

- [x] 5. Implement product and project ordering
  - [x] 5.1 Implement `orderProducts` and `orderProjects`
    - `orderProducts`: stable permutation ordered by ascending `order` then `id`
    - `orderProjects`: recency permutation by `dateCreated` descending, tie-broken by `id`
    - _Requirements: 5.1, 6.1_
  - [x]* 5.2 Write property test for product ordering
    - **Property 10: Product ordering is a stable permutation**
    - **Validates: Requirements 5.1**
    - Min 100 iterations; tag `Feature: website-redesign, Property 10`
  - [x]* 5.3 Write property test for project ordering
    - **Property 11: Project ordering is a recency permutation**
    - **Validates: Requirements 6.1**
    - Min 100 iterations; tag `Feature: website-redesign, Property 11`

- [x] 6. Implement carousel state and slide sequencing (pure core)
  - [x] 6.1 Implement carousel state transitions and slide sequence
    - Implement `advance(state, length)` (wraps last→first), `goTo(state, index, length)`, and the navigation open-state reducer used for dropdown control
    - Implement `buildSlideSequence(slides, failedIds)`: returns non-failed slides in original relative order
    - _Requirements: 3.2, 3.5, 3.6, 3.11, 1.5, 9.5, 9.6_
  - [x]* 6.2 Write property test for the single-slide invariant
    - **Property 6: Carousel always displays exactly one in-range slide**
    - **Validates: Requirements 3.2, 9.5, 9.6**
    - Use the carousel action-sequence generator; min 100 iterations; tag `Feature: website-redesign, Property 6`
  - [x]* 6.3 Write property test for carousel transitions
    - **Property 7: Carousel transitions are correct (wrap and target)**
    - **Validates: Requirements 3.5, 3.6**
    - Min 100 iterations; tag `Feature: website-redesign, Property 7`
  - [x]* 6.4 Write property test for failed-slide exclusion
    - **Property 8: Failed slides are excluded while order is preserved**
    - **Validates: Requirements 3.11**
    - Min 100 iterations; tag `Feature: website-redesign, Property 8`
  - [x]* 6.5 Write property test for dropdown open-state
    - **Property 4: At most one dropdown menu is open**
    - **Validates: Requirements 1.5**
    - Apply random sequences of "open menu" actions to the reducer; min 100 iterations; tag `Feature: website-redesign, Property 4`

- [x] 7. Checkpoint - Ensure all pure-core tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement route resolution
  - [x] 8.1 Implement `resolveRoute`
    - Resolve a URL path to an IA page; parameterized detail routes (`/products/:slug`, `/projects/:slug`) backed by products/projects
    - Reserved paths (`/search`, `/login`, `/register`) and unknown paths return a not-found result; never expose search/login/registration
    - _Requirements: 7.6, 8.5_
  - [x]* 8.2 Write property test for reserved-path routing
    - **Property 13: Reserved paths resolve to not-found**
    - **Validates: Requirements 8.5**
    - Min 100 iterations; tag `Feature: website-redesign, Property 13`

- [x] 9. Implement Schema.org JSON-LD emission
  - [x] 9.1 Implement JSON-LD derivation functions
    - Implement `toProductJsonLd`, `toCreativeWorkJsonLd`, `toSiteNavigationJsonLd`, `toWebPageJsonLd`, `toWebSiteJsonLd`, and `renderJsonLdScript`
    - Emit only Schema.org-aligned fields (`name`, `description`, `image`, `url`, plus `dateCreated` for projects); never emit internal fields (`id`, `slug`, `order`, `detailPageId`, `body`)
    - Add a header comment in the JSON-LD module documenting the decision to **align the content model with Schema.org field names and emit JSON-LD**, with rationale: interoperability and SEO/AI-crawler benefits "for free" since authored content is already Schema.org-shaped, needing only a thin derivation rather than a translation layer
    - _Requirements: 5.2, 6.1, 6.2_
  - [x]* 9.2 Write property test for JSON-LD derivation
    - **Property 14: JSON-LD derivation is well-formed and reflects authored content**
    - **Validates: Requirements 5.2, 6.2, 6.1**
    - Vary presence of optional `image`/`url`; assert `@context`/`@type` correctness, present fields preserved, internal fields absent, and nav → ItemList of SiteNavigationElement one-to-one; min 100 iterations; tag `Feature: website-redesign, Property 14`

- [x] 10. Author seed content and add build-time validation smoke check
  - [x] 10.1 Author seed JSON content and validate it at build time
    - Create `ia.json`, `products.json`, `projects.json`, `slides.json`, `mission.json` representing the existing content, using Schema.org-aligned field names
    - Wire a build/test smoke check that runs all shipped JSON through the own validator and IA integrity checks, failing the build on any violation
    - _Requirements: 2.1, 2.3, 2.4_

- [x] 11. Implement navigation and footer Astro components
  - [x] 11.1 Build the NavigationBar component (static-rendered)
    - Render top-level items from `buildNavModel(ia)`; link items navigate directly, menu items expose dropdown children
    - Persistent current-section indicator using active-section computation; visible focus indicator; Tab focus movement and Enter/Space activation; at most one dropdown open (drives the open-state reducer from task 6.1)
    - Below 768px: collapse to a single toggle control that shows/hides all items and children
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 9.2, 9.3, 9.4_
  - [x] 11.2 Build the Footer directory component (static-rendered)
    - Render `buildFooterDirectory(ia)` on every page; group labels are the non-technical section labels; directory links navigate; unavailable target → 404 page
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 9.2_
  - [x]* 11.3 Write interaction/unit tests for navigation and footer
    - Dropdown opens on click/Enter/Space (1.3), link items navigate (1.4), dropdown link navigates and closes (1.6), focus indicator + keyboard operation (1.8), collapsible toggle shows/hides below 768px (9.3, 9.4), footer present on every page (7.1), directory links navigate (7.5)
    - _Requirements: 1.3, 1.4, 1.6, 1.8, 7.1, 7.5, 9.3, 9.4_

- [x] 12. Implement the hero carousel as a hydrated island
  - [x] 12.1 Build the Carousel island component (client-interactive)
    - Implement the carousel as a hydrated Astro island (e.g. `client:visible`/`client:idle`) using the pure state functions from task 6.1: exactly one slide at a time, auto-advance at the configured 5–8s interval when idle, wrap last→first, prev/next and direct slide-target controls, CTA navigation
    - Pause on interaction/focus; resume within 8s after interaction ends; exclude failed slides via `buildSlideSequence` and stop auto-advancing if only one remains
    - Add a header comment in the carousel island documenting why this specific component is a **hydrated island** while the rest of the site stays static: only the carousel needs client-side interactivity/timing, so hydrating just this island keeps the rest of the page static and fast
    - _Requirements: 3.2, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 9.5, 9.6_
  - [x] 12.2 Build the HeroSection with Mission statement
    - Compose the carousel island with the Mission_Statement directly beneath it (≤48px gap), always visible without interaction and unchanged as slides advance
    - Render mission placeholder text and preserve reserved layout space when mission copy is unavailable
    - _Requirements: 3.1, 4.1, 4.2, 4.3, 4.4_
  - [x]* 12.3 Write interaction/timing tests for the hero (fake timers)
    - Auto-advance interval (3.4), pause on interaction/focus (3.7), resume within 8s (3.8), CTA navigation (3.9), prev/next present (3.10), hero at top of home (3.1), mission gap ≤48px (4.1), mission visible without interaction (4.2), unchanged as slides advance (4.3), placeholder + reserved space (4.4)
    - _Requirements: 3.1, 3.4, 3.7, 3.8, 3.9, 3.10, 4.1, 4.2, 4.3, 4.4_

- [x] 13. Implement product and project presentation components
  - [x] 13.1 Build ProductCatalog and product detail pages
    - Render products via `orderProducts`; each card shows `name`, `description`, and a detail link; empty-state message when none
    - Detail page renders existing content; unavailable detail stays on current page with a message; emit Product JSON-LD on detail pages
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 2.3_
  - [x] 13.2 Build ProjectShowcase and project detail pages
    - Render projects via `orderProjects` (most recent first); each card shows `name`, `description`, and a detail link; empty-state message when none
    - Detail page renders existing content; unavailable detail stays put with a message; emit CreativeWork JSON-LD on detail pages
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 2.4_
  - [x]* 13.3 Write property test for card rendering
    - **Property 12: Cards render all required fields and a detail link**
    - **Validates: Requirements 5.2, 6.2**
    - Assert rendered card contains `name`, `description`, and a link resolving to the item's detail page; min 100 iterations; tag `Feature: website-redesign, Property 12`
  - [x]* 13.4 Write unit tests for detail and empty states
    - Selection navigates (5.3, 6.3), detail renders existing content (5.4, 6.4), unavailable detail stays put with message (5.5, 6.5), empty-state messages (5.6, 6.6), products under Products section (2.3), projects under Projects section (2.4)
    - _Requirements: 2.3, 2.4, 5.3, 5.4, 5.5, 5.6, 6.3, 6.4, 6.5, 6.6_

- [x] 14. Apply global design tokens and theming
  - [x] 14.1 Implement the shared design-token module and global styles
    - Define typography family, color palette, heading/body sizes, and spacing scale applied globally so corresponding element types render identically across pages
    - Ensure Navigation_Bar, Footer, and single-slide Carousel render at ≥320px
    - _Requirements: 9.1, 9.2, 9.5_
  - [x]* 14.2 Write theming/responsiveness tests
    - Consistent style attributes across pages (9.1), nav+footer present with working links at ≥320px (9.2)
    - _Requirements: 9.1, 9.2_

- [x] 15. Wire pages, routing, and JSON-LD into the site shell
  - [x] 15.1 Assemble the site shell and home page, wire routing and structured data
    - Build the shared layout (nav + footer on every page) and the home page composing HeroSection, ProductCatalog, and ProjectShowcase
    - Wire `resolveRoute` into Astro routing including the 404 page (using the site layout) for unknown/removed pages and reserved paths
    - Emit WebPage JSON-LD on every page and WebSite JSON-LD at the site root; emit SiteNavigationElement ItemList for navigation
    - Ensure zero search inputs, zero login controls, and zero registration controls render on any page, and pages load without auth prompts
    - _Requirements: 7.1, 7.6, 8.1, 8.2, 8.3, 8.4, 8.5_
  - [x]* 15.2 Write excluded-features and integration/smoke tests
    - No search inputs (8.1), no login controls (8.2), no registration controls (8.3), pages load without auth (8.4), reserved/unknown paths → 404 (8.5, 7.6); route-resolution smoke over representative paths; snapshot of composed home page
    - _Requirements: 7.6, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP; core implementation tasks are never optional.
- Each task references specific requirements (granular sub-requirements) for traceability.
- Property-based tests use **fast-check**, one test per correctness property, each at a minimum of 100 iterations, tagged with `Feature: website-redesign, Property {n}`.
- Example/interaction tests cover UI behavior, timing, layout, accessibility, and routing wiring that are not universal properties.
- Technology decisions are documented in code comments as they are implemented: Astro + TypeScript static-first with selective hydration (tasks 1, 12.1), the hand-written JSON Schema draft 2020-12 validator (task 2.2), Schema.org alignment + JSON-LD emission (task 9.1), and the single-source-of-truth IA driving nav and footer (task 4.1).
- All 14 correctness properties are covered: P1 (4.3), P2 (4.4), P3 (3.2), P4 (6.5), P5 (4.5), P6 (6.2), P7 (6.3), P8 (6.4), P9 (2.3), P10 (5.2), P11 (5.3), P12 (13.3), P13 (8.2), P14 (9.2).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "6.1"] },
    { "id": 3, "tasks": ["2.3", "3.1", "5.1", "6.2", "6.3", "6.4", "6.5"] },
    { "id": 4, "tasks": ["3.2", "4.1", "4.2", "5.2", "5.3", "8.1", "9.1"] },
    { "id": 5, "tasks": ["4.3", "4.4", "4.5", "8.2", "9.2", "10.1"] },
    { "id": 6, "tasks": ["11.1", "11.2", "12.1", "13.1", "13.2", "14.1"] },
    { "id": 7, "tasks": ["11.3", "12.2", "13.3", "13.4", "14.2", "15.1"] },
    { "id": 8, "tasks": ["12.3", "15.2"] }
  ]
}
```
