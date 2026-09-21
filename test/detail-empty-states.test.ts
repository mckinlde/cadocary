/**
 * =============================================================================
 * Example-based unit tests — case-study collection, detail, and empty states
 * =============================================================================
 *
 * Task 10.4 (example/interaction tests, NOT property-based) for the
 * corporate-site-positioning spec. These cover the concrete case-study
 * collection/detail and empty-state behaviors called out in the task and
 * requirements:
 *
 *   - Three seed case studies present            (Req 4.1)
 *   - Empty-state message                         (Req 4.8)
 *   - Detail-unavailable stays put with a message (Req 4.7)
 *   - Client metrics attributed to the client +
 *     client-site link-out present               (Req 4.2, 4.5)
 *
 * SCOPE NOTE (what is covered here vs. deferred to e2e):
 * Rendering the actual `.astro` components/pages in Vitest is heavy and brittle,
 * so these tests exercise the SAME testable logic the pages/components are built
 * on, using the REAL shipped seed content (loaded through `loadContent`, so this
 * doubles as an integration check that the seed content is valid):
 *
 *   - "Three seed case studies present" is verified against the loaded, ordered
 *     case-study collection: spendlogic, hotels4truckers, and purlpal all appear
 *     (Req 4.1).
 *   - "Selection navigates" is verified at the routing layer: a case-study
 *     card's `/work/{slug}` href resolves to the matching case study (the
 *     `kind: "caseStudy"` router variant). The anchor click + in-browser timing
 *     ("within 2s") is a UI concern deferred to e2e.
 *   - "Detail renders / unavailable detail stays put" is verified via the exact
 *     `hasDetail` predicate the `/work/[slug].astro` page uses
 *     (`orderedCaseStudySections(caseStudy).length > 0`): true selects the
 *     content branch, false selects the message branch. The rendered DOM /
 *     message copy is a UI concern verified here at the predicate level only.
 *   - "Empty-state message" is verified via `orderCaseStudies([])` returning `[]`
 *     — the exact condition `CaseStudyCollection.astro` switches on to render the
 *     "No case studies are currently available." message.
 *   - "Client metrics attribution + client-site link-out" is verified against
 *     the real seed content: every proof point carries an `attribution`, the
 *     client-published metrics are attributed to `"client"` (framed as the
 *     client's results, never Cadocary's), and every case study exposes a
 *     `clientSiteUrl` link-out to the live client site (Req 4.2, 4.5).
 */
import { describe, it, expect } from "vitest";

import {
  loadContent,
  type ContentSource,
  type ContentBundle,
} from "../src/domain/content-loader";
import { orderCaseStudies } from "../src/domain/ordering";
import { orderedCaseStudySections } from "../src/domain/cards";
import { resolveRoute } from "../src/domain/router";
import type { CaseStudy } from "../src/types";

// Real, shipped seed content — loading it here makes these tests double as an
// integration check that the seed content is valid and internally consistent.
import ia from "../src/content/ia.json";
import products from "../src/content/products.json";
import caseStudies from "../src/content/caseStudies.json";
import services from "../src/content/services.json";
import slideDeck from "../src/content/slides.json";
import mission from "../src/content/mission.json";

const source: ContentSource = {
  ia,
  products,
  caseStudies,
  services,
  slideDeck,
  mission,
};

/** The three seed engagements that MUST appear as case studies (Req 4.1). */
const SEED_CASE_STUDY_SLUGS = ["spendlogic", "hotels4truckers", "purlpal"] as const;

/** Load the real seed content once; fail the suite loudly if it is invalid. */
function loadBundle(): ContentBundle {
  const result = loadContent(source, { failLoud: false });
  if (!result.ok) {
    const detail = result.error.issues
      .map((issue) => `  - ${issue.path}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Seed content failed to load [${result.error.source}]:\n${detail}`,
    );
  }
  return result.value;
}

/**
 * Mirror of the `/work/[slug].astro` detail page's availability predicate:
 *   const sections = orderedCaseStudySections(caseStudy);
 *   const hasDetail = sections.length > 0;
 * true → render the four structured sections; false → stay on the page and show
 * the "details cannot be displayed" message (Req 4.7).
 */
function hasDetail(caseStudy: CaseStudy): boolean {
  return orderedCaseStudySections(caseStudy).length > 0;
}

describe("case-study collection, detail & empty states (task 10.4)", () => {
  const bundle = loadBundle();
  const { ia: loadedIa, products: loadedProducts, caseStudies: loadedCaseStudies } =
    bundle;

  /* ---------------------------------------------------------------------------
   * Three seed case studies present (Req 4.1)
   * The Case_Study_Collection presents each existing client engagement
   * (hotels4truckers, purlpal, spendlogic) as a Case_Study.
   * ------------------------------------------------------------------------ */
  describe("the three seed engagements are present as case studies (4.1)", () => {
    it("presents exactly the three seed case studies via the date-free ordering (4.1)", () => {
      const ordered = orderCaseStudies(loadedCaseStudies);
      const slugs = ordered.map((c) => c.slug);
      // Every required seed engagement is present.
      for (const slug of SEED_CASE_STUDY_SLUGS) {
        expect(slugs).toContain(slug);
      }
      // Ordering is a permutation: same multiset as the loaded collection.
      expect([...slugs].sort()).toEqual([...new Set(slugs)].sort());
      expect(ordered.length).toBe(loadedCaseStudies.length);
    });

    it("each seed case study is a real, distinct entry with a stable id/slug (4.1)", () => {
      for (const slug of SEED_CASE_STUDY_SLUGS) {
        const match = loadedCaseStudies.filter((c) => c.slug === slug);
        expect(match.length).toBe(1);
        expect(match[0]!.id).toBe(slug);
        expect(match[0]!.name.length).toBeGreaterThan(0);
      }
    });
  });

  /* ---------------------------------------------------------------------------
   * Selection navigates to the detail page (4.4 support for 4.1)
   * A case-study card links to `/work/{slug}`. Resolving that href routes to a
   * real destination for the item — never not-found.
   * ------------------------------------------------------------------------ */
  describe("selection navigates to the case-study detail page", () => {
    it("resolves each case study's card href to that case study's detail route", () => {
      expect(loadedCaseStudies.length).toBeGreaterThan(0);
      for (const caseStudy of loadedCaseStudies) {
        const href = `/work/${caseStudy.slug}`;
        const result = resolveRoute(href, loadedIa, loadedProducts, loadedCaseStudies);
        // Must navigate somewhere real (not a broken/404 result).
        expect(result.kind).not.toBe("not-found");
        if (result.kind === "caseStudy") {
          expect(result.caseStudy.id).toBe(caseStudy.id);
        } else if (result.kind === "page") {
          // Reached via the dedicated IA entry: its path is the detail path.
          expect(result.page.path).toBe(href);
        } else {
          throw new Error(`unexpected route kind "${result.kind}" for ${href}`);
        }
      }
    });
  });

  /* ---------------------------------------------------------------------------
   * Detail renders existing content (4.5)
   * The seed case studies expose the four structured sections, so the detail
   * page takes the "render content" branch (hasDetail === true).
   * ------------------------------------------------------------------------ */
  describe("detail page renders the structured sections (4.5)", () => {
    it("every seed case study exposes the four ordered sections and takes the content branch (4.5)", () => {
      for (const caseStudy of loadedCaseStudies) {
        const sections = orderedCaseStudySections(caseStudy);
        // Fixed problem → approach → whatWasBuilt → outcome order, each once.
        expect(sections.map((s) => s.kind)).toEqual([
          "problem",
          "approach",
          "whatWasBuilt",
          "outcome",
        ]);
        expect(hasDetail(caseStudy)).toBe(true);
      }
    });
  });

  /* ---------------------------------------------------------------------------
   * Unavailable detail stays put with a message (4.7)
   * For a case study whose sections are empty, the predicate is false — the
   * branch that keeps the page and shows the "cannot be displayed" message.
   * ------------------------------------------------------------------------ */
  describe("unavailable detail takes the message branch (4.7)", () => {
    it("hasDetail is false for a case study with no sections (4.7)", () => {
      const template = loadedCaseStudies[0]!;
      const emptySectionsCaseStudy: CaseStudy = { ...template, sections: [] };
      expect(hasDetail(emptySectionsCaseStudy)).toBe(false);
    });

    it("a case study with sections stays on the content branch, never blank (4.7)", () => {
      // Sanity: the seed content never triggers the unavailable branch, so the
      // page renders sections rather than the fallback message.
      for (const caseStudy of loadedCaseStudies) {
        expect(hasDetail(caseStudy)).toBe(true);
      }
    });
  });

  /* ---------------------------------------------------------------------------
   * Empty-state message (4.8)
   * The collection renders the empty message when the ordered list is empty.
   * orderCaseStudies([]) returns [] — the exact condition CaseStudyCollection
   * switches on to render "No case studies are currently available."
   * ------------------------------------------------------------------------ */
  describe("empty collection yields the empty-state branch (4.8)", () => {
    it("orderCaseStudies([]) returns [] so the empty-state message renders (4.8)", () => {
      const ordered = orderCaseStudies([]);
      expect(ordered).toEqual([]);
      expect(ordered.length === 0).toBe(true);
    });

    it("a non-empty collection does NOT take the empty-state branch (4.8)", () => {
      expect(orderCaseStudies(loadedCaseStudies).length).toBeGreaterThan(0);
    });
  });

  /* ---------------------------------------------------------------------------
   * Client-published metrics attributed to the client + client-site link-out
   * (4.2, 4.5)
   * Proof points carry an attribution; client-published metrics are attributed
   * to "client" and framed as the client's results, never Cadocary's. Every
   * case study exposes a clientSiteUrl link-out to the live client site.
   * ------------------------------------------------------------------------ */
  describe("client metrics attribution and client-site link-out (4.2, 4.5)", () => {
    it("every proof point carries an attribution of either 'client' or 'cadocary' (4.5)", () => {
      for (const caseStudy of loadedCaseStudies) {
        for (const point of caseStudy.proofPoints ?? []) {
          expect(["client", "cadocary"]).toContain(point.attribution);
          expect(point.label.length).toBeGreaterThan(0);
        }
      }
    });

    it("case studies with proof points attribute their published metrics to the client (4.5)", () => {
      // SpendLogic and hotels4truckers ship client-attributed proof points; the
      // detail page filters to attribution === "client" and frames them as the
      // client's results. Verify those metrics are attributed to the client.
      const withProof = loadedCaseStudies.filter(
        (c) => (c.proofPoints ?? []).length > 0,
      );
      expect(withProof.length).toBeGreaterThan(0);
      for (const caseStudy of withProof) {
        const clientPoints = (caseStudy.proofPoints ?? []).filter(
          (p) => p.attribution === "client",
        );
        // These are the CLIENT's published results, so they must be attributed
        // to the client (never claimed as Cadocary's own).
        expect(clientPoints.length).toBeGreaterThan(0);
        for (const point of caseStudy.proofPoints ?? []) {
          expect(point.attribution).toBe("client");
        }
      }
    });

    it("every case study exposes a client-site link-out to the live client site (4.2, 4.5)", () => {
      for (const caseStudy of loadedCaseStudies) {
        expect(typeof caseStudy.clientSiteUrl).toBe("string");
        expect(caseStudy.clientSiteUrl.length).toBeGreaterThan(0);
        // Link-out targets the live client site (an absolute http(s) URL),
        // distinct from the internal /work/{slug} detail route.
        expect(caseStudy.clientSiteUrl).toMatch(/^https?:\/\//);
        expect(caseStudy.clientSiteUrl.startsWith("/work/")).toBe(false);
        // A real client organization name accompanies the link-out.
        expect(caseStudy.clientName.length).toBeGreaterThan(0);
      }
    });
  });

  /* ---------------------------------------------------------------------------
   * Section placement (supports 4.1)
   * Case studies are surfaced in the Work section: each item's detailPageId
   * resolves to a page inside the `work` section.
   * ------------------------------------------------------------------------ */
  describe("case studies live under the Work section", () => {
    it("there is a dedicated Work section", () => {
      const sectionIds = new Set(loadedIa.sections.map((s) => s.id));
      expect(sectionIds.has("work")).toBe(true);
    });

    it("every case study's detail page belongs to the Work section", () => {
      const workSection = loadedIa.sections.find((s) => s.id === "work");
      expect(workSection).toBeDefined();
      const workPageIds = new Set((workSection?.pages ?? []).map((p) => p.id));
      for (const caseStudy of loadedCaseStudies) {
        expect(workPageIds.has(caseStudy.detailPageId)).toBe(true);
        const page = (workSection?.pages ?? []).find(
          (p) => p.id === caseStudy.detailPageId,
        );
        expect(page?.path).toBe(`/work/${caseStudy.slug}`);
      }
    });
  });
});
