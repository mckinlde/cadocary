import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  productCard,
  caseStudyCard,
  serviceOfferingCard,
} from "../src/domain/cards";
import { resolveRoute } from "../src/domain/router";
import type {
  IA,
  Product,
  CaseStudy,
  CaseStudySection,
  ServiceOffering,
} from "../src/types";

/**
 * Card-rendering property tests.
 *
 * These properties test the PURE, rendering-relevant derivation the Astro card
 * components rely on (`productCard` / `caseStudyCard` / `serviceOfferingCard` in
 * src/domain/cards.ts) rather than rendering heavyweight Astro components. Those
 * helpers compute the exact fields the components put on the page: a heading, a
 * summary, a call-to-action, the detail `href`, and — for case studies — the
 * resolved image. Testing this derivation faithfully covers the card contract.
 */

const MIN_ITERATIONS = 100;

/**
 * A slug generator: a single lowercase-alnum segment (no "/"), so the resulting
 * detail path is a genuine single-segment parameterized route that `resolveRoute`
 * recognizes (a slug containing "/" is deliberately treated as no match there).
 */
const slugArb = fc
  .stringMatching(/^[a-z][a-z0-9-]{0,20}$/)
  .filter((s) => s.length > 0);

/** name/title: <= 120 chars per the content model; allow the full unicode range. */
const nameArb = fc.string({ minLength: 0, maxLength: 120 });
/** description/summary: <= 300 chars per the content model. */
const descriptionArb = fc.string({ minLength: 0, maxLength: 300 });
/** A non-empty id used for internal bookkeeping. */
const idArb = fc.string({ minLength: 1, maxLength: 12 });

const productArb: fc.Arbitrary<Product> = fc.record({
  name: nameArb,
  description: descriptionArb,
  id: idArb,
  slug: slugArb,
  order: fc.integer({ min: 0, max: 1000 }),
  detailPageId: fc.string({ minLength: 1, maxLength: 12 }),
});

/** The four required case-study sections, each with a trivial body. */
const sectionsArb: fc.Arbitrary<CaseStudySection[]> = fc.constant([
  { kind: "problem", body: [{ type: "paragraph", text: "p" }] },
  { kind: "approach", body: [{ type: "paragraph", text: "a" }] },
  { kind: "whatWasBuilt", body: [{ type: "paragraph", text: "b" }] },
  { kind: "outcome", body: [{ type: "paragraph", text: "o" }] },
] satisfies CaseStudySection[]);

/**
 * An optional explicitly-associated image. Sometimes present with an alt
 * (1..125 chars), sometimes present with a blank src (collapses to `none`), and
 * sometimes absent entirely (also collapses to `none`).
 */
const optionalImageArb: fc.Arbitrary<CaseStudy["image"] | undefined> =
  fc.option(
    fc.record({
      src: fc.oneof(
        fc.constant("/img/case-studies/example.jpg"),
        fc.constant(""), // blank src -> resolveImage collapses to `none`
        fc.webUrl(),
      ),
      alt: fc.string({ minLength: 0, maxLength: 125 }),
    }),
    { nil: undefined },
  );

const caseStudyArb: fc.Arbitrary<CaseStudy> = fc.record({
  name: nameArb,
  description: descriptionArb,
  image: optionalImageArb,
  clientName: fc.string({ minLength: 1, maxLength: 40 }),
  clientSiteUrl: fc.webUrl(),
  engagementRole: fc.string({ minLength: 1, maxLength: 80 }),
  deliverable: fc.string({ minLength: 1, maxLength: 80 }),
  sections: sectionsArb,
  id: idArb,
  slug: slugArb,
  order: fc.integer({ min: 0, max: 1000 }),
  detailPageId: fc.string({ minLength: 1, maxLength: 12 }),
}) as fc.Arbitrary<CaseStudy>;

const serviceOfferingArb: fc.Arbitrary<ServiceOffering> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 120 }),
  // description bounds (80..600) are enforced by the schema; here we only need
  // a non-empty summary, so keep the generator focused on the card contract.
  description: fc.string({ minLength: 1, maxLength: 600 }),
  caseStudyRef: fc.option(fc.oneof(slugArb, idArb), { nil: undefined }),
  id: idArb,
  order: fc.integer({ min: 0, max: 1000 }),
}) as fc.Arbitrary<ServiceOffering>;

/** An empty IA — detail routes are backed by the catalogs, not the IA. */
const EMPTY_IA: IA = { defaultSectionId: "main", sections: [] };

/**
 * Feature: corporate-site-positioning, Property 12: Case_Study card content and detail link
 *
 * For any Case_Study, its card view-model contains the title (≤ 120 chars), the
 * summary (≤ 300 chars), its explicitly associated image (or a collapsed image
 * when none), and a detail link whose href is exactly `/work/{slug}`.
 *
 * Validates: Requirements 4.3
 */
describe("Property 12: Case_Study card content and detail link", () => {
  it("case-study card exposes title, summary, resolved image, and a /work/{slug} link that resolves back to the case study", () => {
    fc.assert(
      fc.property(caseStudyArb, (caseStudy) => {
        const card = caseStudyCard(caseStudy);

        // Title/summary preserved verbatim and within bounds (Requirement 4.3).
        expect(card.name).toBe(caseStudy.name);
        expect(card.description).toBe(caseStudy.description);
        expect(card.name.length).toBeLessThanOrEqual(120);
        expect(card.description.length).toBeLessThanOrEqual(300);

        // Image is resolved from the case study's OWN association: when it has a
        // usable src the image renders it, otherwise it collapses to `none` and
        // never leaks a filename/path as alt (Requirement 6.5).
        const hasUsableSrc =
          typeof caseStudy.image?.src === "string" &&
          caseStudy.image.src.trim() !== "";
        if (hasUsableSrc) {
          expect(card.image.kind).toBe("image");
          if (card.image.kind === "image") {
            expect(card.image.src).toBe(caseStudy.image!.src);
          }
        } else {
          expect(card.image.kind).toBe("none");
        }

        // Detail link is exactly `/work/{slug}` (Requirement 4.3).
        expect(card.href).toBe(`/work/${caseStudy.slug}`);
        expect(card.cta.href).toBe(`/work/${caseStudy.slug}`);

        // ...and that href resolves back to THIS case study via the real routing
        // contract, using a minimal catalog containing just this item.
        const result = resolveRoute(card.href, EMPTY_IA, [], [caseStudy]);
        expect(result.kind).toBe("caseStudy");
        if (result.kind === "caseStudy") {
          expect(result.caseStudy.slug).toBe(caseStudy.slug);
          expect(result.caseStudy.id).toBe(caseStudy.id);
        }
      }),
      { numRuns: MIN_ITERATIONS },
    );
  });
});

/**
 * Feature: corporate-site-positioning, Property 13: Every card exposes heading, summary, and call-to-action
 *
 * For any Product, Case_Study, or Service_Offering rendered as a card, the card
 * view-model exposes a non-empty heading, a summary, and a call-to-action.
 *
 * Validates: Requirements 8.6
 */
describe("Property 13: Every card exposes heading, summary, and call-to-action", () => {
  it("product cards expose a non-empty heading, a summary, and a CTA with a label and href", () => {
    fc.assert(
      fc.property(
        // Products need a non-empty heading, so constrain name to be non-empty.
        productArb.map((p) => ({ ...p, name: p.name || "Product" })),
        (product) => {
          const card = productCard(product);
          expect(typeof card.heading).toBe("string");
          expect(card.heading.length).toBeGreaterThan(0);
          expect(typeof card.summary).toBe("string");
          expect(typeof card.cta.label).toBe("string");
          expect(card.cta.label.length).toBeGreaterThan(0);
          expect(typeof card.cta.href).toBe("string");
          expect(card.cta.href.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });

  it("case-study cards expose a non-empty heading, a summary, and a CTA with a label and href", () => {
    fc.assert(
      fc.property(
        caseStudyArb.map((c) => ({ ...c, name: c.name || "Case study" })),
        (caseStudy) => {
          const card = caseStudyCard(caseStudy);
          expect(typeof card.heading).toBe("string");
          expect(card.heading.length).toBeGreaterThan(0);
          expect(typeof card.summary).toBe("string");
          expect(typeof card.cta.label).toBe("string");
          expect(card.cta.label.length).toBeGreaterThan(0);
          expect(typeof card.cta.href).toBe("string");
          expect(card.cta.href.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });

  it("service-offering cards expose a non-empty heading, a summary, and a CTA whether or not the case-study ref resolves", () => {
    fc.assert(
      fc.property(
        serviceOfferingArb,
        // A resolver that may or may not resolve the ref, exercising both the
        // proof-link and no-proof-link branches of the card contract.
        fc.option(caseStudyArb, { nil: undefined }),
        (offering, maybeCaseStudy) => {
          const caseStudyById = (ref: string): CaseStudy | undefined =>
            maybeCaseStudy &&
            (ref === maybeCaseStudy.id || ref === maybeCaseStudy.slug)
              ? maybeCaseStudy
              : undefined;

          const card = serviceOfferingCard(offering, caseStudyById);
          expect(typeof card.heading).toBe("string");
          expect(card.heading.length).toBeGreaterThan(0);
          expect(typeof card.summary).toBe("string");
          expect(typeof card.cta.label).toBe("string");
          expect(card.cta.label.length).toBeGreaterThan(0);
          expect(typeof card.cta.href).toBe("string");
          expect(card.cta.href.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });
});
