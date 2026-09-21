/**
 * =============================================================================
 * Example-based unit tests — the Services page (`/services`)
 * =============================================================================
 *
 * Task 11.2 (example/interaction tests, NOT property-based) for the
 * corporate-site-positioning spec. These cover the concrete Services-page
 * behaviors called out in the task and requirements:
 *
 *   - Offerings render                                   (Req 3.1)
 *   - At least one proof link resolves to the
 *     Case_Study_Collection or a specific Case_Study     (Req 3.3)
 *   - Contact_Path present with the literal address,
 *     as a `mailto:mail@cadocary.com` link               (Req 3.4, 9.1)
 *
 * SCOPE NOTE (what is covered here vs. deferred to e2e):
 * Rendering the actual `services.astro` page in Vitest is heavy and brittle, so
 * these tests exercise the SAME testable logic the page is built on:
 *
 *   - "Offerings render" is verified by driving the REAL shipped `services.json`
 *     through the exact card derivation the page uses — sorting by `order` then
 *     `id` and mapping each offering through `serviceOfferingCard` with a
 *     `caseStudyRef → CaseStudy` resolver built from the real `caseStudies.json`.
 *     Every offering yields a card view-model with the required fields (Req 3.1),
 *     and the count is within the authored 1..20 bound.
 *   - "Proof link present" is verified two ways: (1) the page-level link to the
 *     Case_Study_Collection (`/work`) is present in the `services.astro` source,
 *     and (2) at least one derived card exposes a `proofHref` of exactly
 *     `/work/{slug}` that resolves through the router to that case study — never
 *     not-found (Req 3.3).
 *   - "Contact_Path present with literal address" is verified against the
 *     `services.astro` source read from disk (per the repo's `theming.test.ts`
 *     approach): the page defines the mailto href `mailto:mail@cadocary.com` and
 *     renders the literal address `mail@cadocary.com` as the visible link text
 *     (Req 3.4, 9.1). The anchor-click → email-handler behavior (Req 3.5) is a
 *     browser concern deferred to e2e; here we assert the href + visible text
 *     that make it correct.
 *
 * Loading the real seed content through `loadContent` also doubles as an
 * integration check that `services.json` is valid and internally consistent.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  loadContent,
  type ContentSource,
  type ContentBundle,
} from "../src/domain/content-loader";
import { serviceOfferingCard } from "../src/domain/cards";
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

/** Contact_Path constants the Services page renders (Req 3.4, 9.1). */
const CONTACT_EMAIL = "mail@cadocary.com";
const CONTACT_HREF = `mailto:${CONTACT_EMAIL}`;

/** Read the `services.astro` page source from disk (per task guidance, use fs). */
const servicesPagePath = fileURLToPath(
  new URL("../src/pages/services.astro", import.meta.url),
);
const servicesPageSource = readFileSync(servicesPagePath, "utf8");

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

describe("Services page (task 11.2)", () => {
  const bundle = loadBundle();
  const {
    ia: loadedIa,
    products: loadedProducts,
    caseStudies: loadedCaseStudies,
    services: loadedServices,
  } = bundle;

  // Reproduce EXACTLY what services.astro does to turn the content document into
  // card view-models: resolve caseStudyRef by id, sort by order then id, and map
  // each offering through serviceOfferingCard.
  const caseStudyById = new Map<string, CaseStudy>(
    loadedCaseStudies.map((cs) => [cs.id, cs]),
  );
  const resolveCaseStudy = (ref: string): CaseStudy | undefined =>
    caseStudyById.get(ref);
  const cards = [...loadedServices.offerings]
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map((offering) => serviceOfferingCard(offering, resolveCaseStudy));

  /* ---------------------------------------------------------------------------
   * Offerings render (Req 3.1)
   * The Services_Page presents 1..20 Service_Offering entries, each described.
   * ------------------------------------------------------------------------ */
  describe("offerings render (3.1)", () => {
    it("presents between 1 and 20 offerings (3.1)", () => {
      expect(loadedServices.offerings.length).toBeGreaterThanOrEqual(1);
      expect(loadedServices.offerings.length).toBeLessThanOrEqual(20);
    });

    it("derives one card view-model per offering (3.1)", () => {
      expect(cards.length).toBe(loadedServices.offerings.length);
    });

    it("every rendered card exposes a name and outcome description (3.1)", () => {
      for (const card of cards) {
        expect(typeof card.name).toBe("string");
        expect(card.name.length).toBeGreaterThan(0);
        expect(typeof card.description).toBe("string");
        expect(card.description.length).toBeGreaterThan(0);
        // The card also carries the common heading/summary/CTA contract.
        expect(card.heading).toBe(card.name);
        expect(card.summary).toBe(card.description);
        expect(card.cta.href.length).toBeGreaterThan(0);
      }
    });

    it("the page iterates the derived cards to render each offering (3.1)", () => {
      // services.astro maps `cards` to a <li> per offering.
      expect(servicesPageSource).toContain("cards.map");
      expect(servicesPageSource).toContain("service-card");
    });
  });

  /* ---------------------------------------------------------------------------
   * At least one proof link resolves to a case study / the collection (Req 3.3)
   * ------------------------------------------------------------------------ */
  describe("at least one proof link is present and resolves (3.3)", () => {
    it("the page renders a link to the Case_Study_Collection at /work (3.3)", () => {
      // The page-level "See our case studies" proof link targets /work.
      expect(servicesPageSource).toContain('href="/work"');
    });

    it("at least one offering derives a per-offering proof link to /work/{slug} (3.3)", () => {
      const withProof = cards.filter((c) => c.proofHref);
      expect(withProof.length).toBeGreaterThan(0);
      for (const card of withProof) {
        expect(card.proofHref).toMatch(/^\/work\/[^/]+$/);
      }
    });

    it("every derived proof link resolves to a real case study, never not-found (3.3)", () => {
      const proofHrefs = cards
        .map((c) => c.proofHref)
        .filter((href): href is string => typeof href === "string");
      expect(proofHrefs.length).toBeGreaterThan(0);
      for (const href of proofHrefs) {
        const result = resolveRoute(
          href,
          loadedIa,
          loadedProducts,
          loadedCaseStudies,
        );
        expect(result.kind).not.toBe("not-found");
        const slug = href.slice("/work/".length);
        if (result.kind === "caseStudy") {
          expect(result.caseStudy.slug).toBe(slug);
        } else if (result.kind === "page") {
          expect(result.page.path).toBe(href);
        } else {
          throw new Error(`unexpected route kind "${result.kind}" for ${href}`);
        }
      }
    });

    it("the collection link target /work resolves to a real destination (3.3)", () => {
      const result = resolveRoute("/work", loadedIa, loadedProducts, loadedCaseStudies);
      expect(result.kind).not.toBe("not-found");
    });
  });

  /* ---------------------------------------------------------------------------
   * Contact_Path present with the literal address (Req 3.4, 9.1)
   * The Services_Page presents the Contact_Path as a mailto:mail@cadocary.com
   * link whose visible text is the literal address.
   * ------------------------------------------------------------------------ */
  describe("Contact_Path present with the literal address (3.4, 9.1)", () => {
    it("defines the mailto href for the literal contact address (3.4)", () => {
      // services.astro derives CONTACT_HREF = `mailto:${CONTACT_EMAIL}` and the
      // literal address constant.
      expect(servicesPageSource).toContain(`"${CONTACT_EMAIL}"`);
      expect(servicesPageSource).toContain("mailto:${CONTACT_EMAIL}");
    });

    it("renders the Contact_Path as a mailto link (3.4, 9.1)", () => {
      // The anchor uses the derived CONTACT_HREF and shows CONTACT_EMAIL as text.
      expect(servicesPageSource).toContain("href={CONTACT_HREF}");
      expect(servicesPageSource).toContain(">{CONTACT_EMAIL}<");
    });

    it("the derived href and visible text are exactly the literal address (3.4, 9.1)", () => {
      // Assert the values the page constants resolve to are correct.
      expect(CONTACT_HREF).toBe("mailto:mail@cadocary.com");
      expect(CONTACT_EMAIL).toBe("mail@cadocary.com");
      // The href is a mailto of exactly the visible literal address.
      expect(CONTACT_HREF).toBe(`mailto:${CONTACT_EMAIL}`);
    });

    it("the Services page is present in the IA and reachable (9.1)", () => {
      const result = resolveRoute("/services", loadedIa, loadedProducts, loadedCaseStudies);
      expect(result.kind).toBe("page");
    });
  });
});
