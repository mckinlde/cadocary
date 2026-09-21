/**
 * =============================================================================
 * Example-based unit tests — Hero Section (Capability_Statement, Mission,
 * home-page section CTAs, and graceful degradation)
 * =============================================================================
 *
 * Task 8.2 (example/unit tests, NOT property-based) for the
 * corporate-site-positioning spec. These cover the concrete Hero_Section
 * behaviors called out in the task and requirements:
 *
 *   - Capability_Statement present & visible without interaction   (Req 1.1, 2.1)
 *   - capability-unavailable placeholder preserves reserved space  (Req 1.8, 2.6)
 *   - home CTAs to Services and Case Studies present with labels    (Req 9.5, 9.6)
 *   - each home top-level section has a heading + intro sentence    (Req 8.3)
 *
 * SCOPE / APPROACH (matches the repo convention — see theming.test.ts):
 * Rendering the hydrated `.astro` component in Vitest is heavy and brittle, so —
 * exactly as `theming.test.ts` scans component CSS from disk and
 * `detail-empty-states.test.ts` exercises the underlying logic — these tests
 * assert against the TWO things HeroSection is actually built on:
 *
 *   1. The component's STATIC RENDERING CONTRACT, read from the
 *      `HeroSection.astro` source on disk: the Capability_Statement and Mission
 *      regions are static server HTML (no client state / no `client:*` directive
 *      on them), so they are present and visible without interaction; both the
 *      real-copy and placeholder branches exist; a `min-height` reserves the
 *      above-the-fold space on BOTH branches; and the section CTAs render as
 *      static, labeled anchors to `/services` and `/work`.
 *   2. The real, shipped `mission.json` content (the Capability_Statement +
 *      Mission copy the home page passes into HeroSection), so the "visible
 *      without interaction" copy actually exists and is non-empty, and the
 *      component's availability predicate (non-empty `body` array) selects the
 *      real-copy branch for the shipped content.
 *
 * The exact predicate HeroSection uses to choose real copy vs. placeholder is
 * mirrored here (`hasContent`) and asserted directly (Req 1.8, 2.6 branch logic).
 *
 * DEFERRED to real-DOM / e2e (documented, not asserted here):
 *   - Actual pixel above-the-fold placement and the "within 3 seconds" wall-clock
 *     bound of Req 1.1 (browser geometry/timing). The content precondition (copy
 *     exists, is static, and reserves space) is asserted here; the timing
 *     precondition is additionally modeled in `hero-carousel.timing.test.ts`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { CapabilityStatement, ContentBlock, Mission } from "../src/types";
// Real, shipped content the home page (task 15.1) passes into HeroSection.
import missionSeed from "../src/content/mission.json";

// Read the component source directly from disk (per repo convention).
const heroSectionPath = fileURLToPath(
  new URL("../src/components/HeroSection.astro", import.meta.url),
);
const heroSource = readFileSync(heroSectionPath, "utf8");

const mission = missionSeed as Mission;
const capability = mission.capability as CapabilityStatement | undefined;

/**
 * Mirror of HeroSection's availability predicate: content is "available" (real
 * copy branch) iff there is an object with a non-empty `body` array; otherwise
 * the placeholder branch renders while the reserved space is preserved. This is
 * exactly the rule the component uses for both Capability_Statement and Mission
 * (Req 1.8, 2.6).
 */
function hasContent(
  doc: { body?: ContentBlock[] } | null | undefined,
): boolean {
  return !!doc && Array.isArray(doc.body) && doc.body.length > 0;
}

/** Isolate the `.hero__capability` region markup from the component source. */
function captureRegion(source: string, marker: string): string {
  const idx = source.indexOf(marker);
  expect(idx, `marker ${marker} not found in HeroSection.astro`).toBeGreaterThan(-1);
  // Take a generous window after the marker so region-local assertions are scoped.
  return source.slice(idx, idx + 1200);
}

describe("Hero Section — static rendering contract (task 8.2)", () => {
  /* ---------------------------------------------------------------------------
   * Capability_Statement present & visible without interaction (Req 1.1, 2.1)
   * ------------------------------------------------------------------------ */
  describe("Capability_Statement is static and visible without interaction (1.1, 2.1)", () => {
    it("renders a dedicated Capability_Statement region", () => {
      expect(heroSource).toContain("hero__capability");
      expect(heroSource).toMatch(/hero__capability-heading/);
    });

    it("renders the Capability_Statement as static server HTML (no client:* hydration on it)", () => {
      // The only hydrated island in the hero is the <Carousel/>. The capability
      // region must NOT carry a client:* directive — that is what guarantees it
      // is present/visible WITHOUT any interaction (Req 1.1, 2.1).
      const region = captureRegion(heroSource, 'class="hero__capability"');
      expect(region).not.toMatch(/client:(load|idle|visible|media|only)/);
    });

    it("exposes both the real-copy branch and the placeholder branch for the capability", () => {
      // Real copy branch renders the authored body via <ContentBody/>.
      expect(heroSource).toContain("hero__capability-body");
      // Placeholder branch (the graceful-degradation path).
      expect(heroSource).toContain("hero__capability-placeholder");
    });

    it("the shipped Capability_Statement copy exists and is non-empty (visible content, 1.1/2.1)", () => {
      expect(capability, "mission.json is missing its capability block").toBeTruthy();
      expect(typeof capability!.heading).toBe("string");
      expect(capability!.heading.length).toBeGreaterThan(0);
      expect(Array.isArray(capability!.body)).toBe(true);
      expect(capability!.body.length).toBeGreaterThan(0);
      // With non-empty copy, the component selects the real-copy branch.
      expect(hasContent(capability)).toBe(true);
    });

    it("the Capability_Statement identifies Cadocary as a builder of custom software (1.1)", () => {
      const text = JSON.stringify(capability!.body).toLowerCase();
      expect(text).toContain("custom software");
      expect(text).toContain("organizations");
    });
  });

  /* ---------------------------------------------------------------------------
   * Capability-unavailable placeholder preserves reserved space (Req 1.8, 2.6)
   * ------------------------------------------------------------------------ */
  describe("capability-unavailable placeholder preserves reserved space (1.8, 2.6)", () => {
    it("renders a 'temporarily unavailable' placeholder for the capability", () => {
      const region = captureRegion(heroSource, 'class="hero__capability"');
      expect(region.toLowerCase()).toContain("temporarily unavailable");
    });

    it("reserves above-the-fold layout space via a min-height on the capability region (1.8, 2.6)", () => {
      // The reserved space must apply regardless of which branch renders, so the
      // page does not shift between real copy and the placeholder. A min-height
      // on the .hero__capability rule is what enforces this.
      const rule = heroSource.match(/\.hero__capability\s*\{[\s\S]*?\}/);
      expect(rule, "no .hero__capability CSS rule found").not.toBeNull();
      expect(rule![0]).toMatch(/min-height\s*:/);
    });

    it("availability predicate: absent/empty capability body → placeholder branch (1.8, 2.6)", () => {
      // The component chooses real copy vs. placeholder using this exact rule.
      expect(hasContent(capability)).toBe(true); // shipped copy → real branch
      expect(hasContent(null)).toBe(false); // failed load → placeholder
      expect(hasContent(undefined)).toBe(false); // absent → placeholder
      expect(hasContent({ body: [] })).toBe(false); // empty body → placeholder
    });
  });

  /* ---------------------------------------------------------------------------
   * Mission region: static, visible without interaction, reserves space
   * (supports Req 1.2, and the graceful-degradation contract 1.8/2.6)
   * ------------------------------------------------------------------------ */
  describe("Mission region is static and reserves space (supports 1.2, 1.8, 2.6)", () => {
    it("renders a dedicated Mission region with both branches", () => {
      expect(heroSource).toContain("hero__mission");
      expect(heroSource).toContain("hero__mission-body");
      expect(heroSource).toContain("hero__mission-placeholder");
    });

    it("the Mission region is not hydrated (visible without interaction)", () => {
      const region = captureRegion(heroSource, 'class="hero__mission"');
      expect(region).not.toMatch(/client:(load|idle|visible|media|only)/);
    });

    it("reserves layout space via a min-height on the mission region (1.8, 2.6)", () => {
      const rule = heroSource.match(/\.hero__mission\s*\{[\s\S]*?\}/);
      expect(rule, "no .hero__mission CSS rule found").not.toBeNull();
      expect(rule![0]).toMatch(/min-height\s*:/);
    });

    it("the shipped Mission copy exists and is non-empty", () => {
      expect(hasContent(mission)).toBe(true);
      expect(mission.heading.length).toBeGreaterThan(0);
    });
  });

  /* ---------------------------------------------------------------------------
   * Home section navigation to Services and Case Studies (Req 9.5, 9.6)
   * ------------------------------------------------------------------------ */
  // In the hybrid home layout, the distinct, labeled links to each top-level
  // section live in the SECTIONS themselves (each renders a "See all →" link to
  // its detail page) rather than as CTA cards in the hero. So the hero no longer
  // owns these links; index.astro wires them via seeAllHref. We assert that the
  // home page provides the distinct, labeled links to Services (/services) and
  // Case Studies (/work), satisfying Req 9.5 / 9.6.
  describe("home-page section navigation to Services and Case Studies (9.5, 9.6)", () => {
    const indexSource = readFileSync(
      fileURLToPath(new URL("../src/pages/index.astro", import.meta.url)),
      "utf8",
    );

    it("wires a distinct 'See all services' link to /services on the home page (9.5)", () => {
      expect(indexSource).toMatch(/seeAllHref=["']\/services["']/);
      expect(indexSource.toLowerCase()).toContain("see all services");
    });

    it("wires a distinct 'See all case studies' link to /work on the home page (9.6)", () => {
      expect(indexSource).toMatch(/seeAllHref=["']\/work["']/);
      expect(indexSource.toLowerCase()).toContain("see all case studies");
    });

    it("also wires the Products section see-all link to /products", () => {
      expect(indexSource).toMatch(/seeAllHref=["']\/products["']/);
      expect(indexSource.toLowerCase()).toContain("see all products");
    });

    it("the hero no longer renders duplicate section CTA cards (moved into the sections)", () => {
      expect(heroSource).not.toContain("hero__cta-card");
      expect(heroSource).not.toContain("hero__cta-link");
    });
  });
});
