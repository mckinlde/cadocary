/**
 * =============================================================================
 * ARCHITECTURE: Astro + TypeScript, static-first with selective hydration
 * =============================================================================
 *
 * This module is documentation-only. It records the top-level architecture
 * decision for the website redesign so the rationale lives alongside the code.
 *
 * ## Decision
 *
 * The site is built with **Astro + TypeScript (strict)** and is **static-first**:
 * every page is server-rendered / pre-rendered to plain HTML at build time.
 * Interactivity is added **selectively**, through hydrated "islands" — and the
 * ONLY island in this project is the hero carousel.
 *
 * ## Why static-first
 *
 * - **Speed.** Pages are HTML by the time they reach the browser. There is no
 *   client-side framework to download, parse, and boot before content appears,
 *   so first paint and time-to-interactive are fast even on slow devices.
 * - **SEO & structured data.** Fully rendered HTML (including the Schema.org
 *   JSON-LD we emit) is present in the initial response, so crawlers and AI
 *   agents see complete content without executing JavaScript.
 * - **Minimal client JS — the key advantage.** Astro ships zero JavaScript by
 *   default. Because our navigation, footer, product/project catalogs, mission
 *   statement, and layout are all static, none of them add client bundle
 *   weight. Only the carousel — which genuinely needs timers, state, and
 *   pointer/keyboard interaction — is hydrated. This "islands architecture"
 *   keeps the JS payload to just the one interactive component instead of
 *   hydrating the whole page.
 *
 * ## Why the carousel is the sole hydrated island
 *
 * The carousel must auto-advance on a timer, pause on interaction/focus, resume,
 * and respond to prev/next and direct-target controls. That behavior is
 * inherently client-side and stateful. Everything else on the site is
 * presentational and derivable from content at build time, so it stays static.
 * Hydrating just this island (e.g. `client:visible` / `client:idle`) confines
 * client JavaScript to the one place that needs it.
 *
 * ## Why TypeScript strict
 *
 * The domain layer is a set of pure functions over structured content (IA →
 * nav/footer models, ordering, carousel state, slide sequencing, JSON-LD). Strict
 * typing makes those transformations self-documenting and lets the shared types
 * in `src/types.ts` mirror the validated JSON Schemas precisely, catching content
 * shape mismatches at compile time.
 *
 * See `src/types.ts` for the shared data models referenced throughout the design.
 */
export {};
