import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  validate,
  productSchema,
  projectSchema,
  slideDeckSchema,
  caseStudySchema,
  servicesPageSchema,
} from "../src/schema";

/**
 * Feature: website-redesign, Property 9: Content validation enforces all declared bounds
 *
 * For any generated content, validation (JSON Schema draft 2020-12) accepts it
 * if and only if: the slide deck length is between 2 and 10 inclusive, the
 * auto-advance interval is between 5 and 8 seconds inclusive, every product
 * `name` and project `name` is at most 120 characters, and every product and
 * project `description` is at most 300 characters.
 *
 * Validates: Requirements 3.3, 3.4, 5.2, 6.2
 *
 * Strategy: each generator produces documents that are otherwise structurally
 * valid, so the ONLY thing that can cause rejection is a declared-bound
 * violation. We generate string lengths and numeric values that straddle each
 * boundary (below, at, and above the limits) and assert that the validator
 * accepts the document exactly when every declared bound holds.
 */

const MIN_ITERATIONS = 100;

/** Build a string of exactly `len` code points (single-code-point chars). */
function stringOfLength(len: number): string {
  return "a".repeat(len);
}

/** A single otherwise-valid slide (no bounds of interest live on a slide). */
function makeSlide(i: number) {
  return {
    id: `slide-${i}`,
    image: { src: `/img/${i}.png`, alt: `alt ${i}` },
    heading: `Heading ${i}`,
  };
}

describe("Property 9: Content validation enforces all declared bounds", () => {
  it("accepts a product iff name <= 120 and description <= 300", () => {
    fc.assert(
      fc.property(
        // name length straddling 120, description length straddling 300
        fc.integer({ min: 0, max: 130 }),
        fc.integer({ min: 0, max: 320 }),
        (nameLen, descLen) => {
          const product = {
            name: stringOfLength(nameLen),
            description: stringOfLength(descLen),
            id: "p1",
            slug: "p-1",
            order: 0,
            detailPageId: "page-1",
          };

          const result = validate(product, productSchema);
          const withinBounds = nameLen <= 120 && descLen <= 300;

          expect(result.ok).toBe(withinBounds);
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });

  it("accepts a project iff name <= 120 and description <= 300", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 130 }),
        fc.integer({ min: 0, max: 320 }),
        (nameLen, descLen) => {
          const project = {
            name: stringOfLength(nameLen),
            description: stringOfLength(descLen),
            dateCreated: "2024-01-15",
            id: "j1",
            slug: "j-1",
            detailPageId: "page-2",
          };

          const result = validate(project, projectSchema);
          const withinBounds = nameLen <= 120 && descLen <= 300;

          expect(result.ok).toBe(withinBounds);
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });

  it("accepts a slide deck iff slide count is 2..10 and interval is 5..8", () => {
    fc.assert(
      fc.property(
        // slide count straddling [2, 10]
        fc.integer({ min: 0, max: 13 }),
        // interval straddling [5, 8]
        fc.integer({ min: 0, max: 12 }),
        (slideCount, intervalSeconds) => {
          const slides = Array.from({ length: slideCount }, (_, i) =>
            makeSlide(i),
          );
          const deck = { slides, intervalSeconds };

          const result = validate(deck, slideDeckSchema);
          const withinBounds =
            slideCount >= 2 &&
            slideCount <= 10 &&
            intervalSeconds >= 5 &&
            intervalSeconds <= 8;

          expect(result.ok).toBe(withinBounds);
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });

  it("jointly: content is accepted iff ALL declared bounds hold across documents", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 130 }), // product name length
        fc.integer({ min: 0, max: 320 }), // product description length
        fc.integer({ min: 0, max: 130 }), // project name length
        fc.integer({ min: 0, max: 320 }), // project description length
        fc.integer({ min: 0, max: 13 }), // slide count
        fc.integer({ min: 0, max: 12 }), // interval seconds
        (
          prodNameLen,
          prodDescLen,
          projNameLen,
          projDescLen,
          slideCount,
          intervalSeconds,
        ) => {
          const product = {
            name: stringOfLength(prodNameLen),
            description: stringOfLength(prodDescLen),
            id: "p1",
            slug: "p-1",
            order: 0,
            detailPageId: "page-1",
          };
          const project = {
            name: stringOfLength(projNameLen),
            description: stringOfLength(projDescLen),
            dateCreated: "2024-01-15",
            id: "j1",
            slug: "j-1",
            detailPageId: "page-2",
          };
          const deck = {
            slides: Array.from({ length: slideCount }, (_, i) => makeSlide(i)),
            intervalSeconds,
          };

          const productOk = validate(product, productSchema).ok;
          const projectOk = validate(project, projectSchema).ok;
          const deckOk = validate(deck, slideDeckSchema).ok;

          const productBoundsHold = prodNameLen <= 120 && prodDescLen <= 300;
          const projectBoundsHold = projNameLen <= 120 && projDescLen <= 300;
          const deckBoundsHold =
            slideCount >= 2 &&
            slideCount <= 10 &&
            intervalSeconds >= 5 &&
            intervalSeconds <= 8;

          // Accept IFF the respective declared bounds hold.
          expect(productOk).toBe(productBoundsHold);
          expect(projectOk).toBe(projectBoundsHold);
          expect(deckOk).toBe(deckBoundsHold);
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });
});

/**
 * Feature: corporate-site-positioning, Property 8: Authored content respects
 * declared bounds
 *
 * For any authored Product, Case_Study, Service_Offering, or content-image alt
 * text that passes validation, its bounded fields satisfy their declared limits
 * (product name <= 120 and description <= 300; case-study name <= 120 and
 * description <= 300, and image.alt within 1..125 when present; service name
 * <= 120 and description within 80..600; content-image alt within 1..125); and
 * for any generated value that violates a bound, validation rejects it.
 *
 * Validates: Requirements 2.5, 3.2, 4.3, 6.4
 *
 * Strategy: each generator produces documents that are otherwise structurally
 * valid, so the ONLY thing that can cause rejection is the declared-bound
 * violation under test. We generate string lengths that straddle each boundary
 * (below, at, and above the limit) and assert that the validator accepts the
 * document exactly when every declared bound holds.
 */

/** A single valid Case_Study section for a given kind (body has 1 paragraph). */
function makeSection(kind: string) {
  return {
    kind,
    body: [{ type: "paragraph", text: "Body copy." }],
  };
}

/** All four required Case_Study section kinds, each present exactly once. */
function allFourSections() {
  return [
    makeSection("problem"),
    makeSection("approach"),
    makeSection("whatWasBuilt"),
    makeSection("outcome"),
  ];
}

/**
 * Build an otherwise-valid Case_Study whose only variable fields are the ones
 * under test. `altLen === 0` means the optional `image` is omitted entirely
 * (so no alt bound applies); any positive length attaches an `image` whose alt
 * has exactly that many characters (bound: 1..125).
 */
function makeCaseStudy(nameLen: number, descLen: number, altLen: number) {
  const base: Record<string, unknown> = {
    name: stringOfLength(nameLen),
    description: stringOfLength(descLen),
    clientName: "Acme",
    clientSiteUrl: "https://example.com",
    engagementRole: "Design and implementation consultancy.",
    deliverable: "An end-to-end platform.",
    sections: allFourSections(),
    id: "cs1",
    slug: "cs-1",
    order: 0,
    detailPageId: "page-cs-1",
  };
  if (altLen > 0) {
    base.image = { src: "/img/cs.png", alt: stringOfLength(altLen) };
  }
  return base;
}

describe("Feature: corporate-site-positioning, Property 8: Authored content respects declared bounds", () => {
  it("accepts a product iff name <= 120 and description <= 300", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 130 }),
        fc.integer({ min: 0, max: 320 }),
        (nameLen, descLen) => {
          const product = {
            name: stringOfLength(nameLen),
            description: stringOfLength(descLen),
            id: "p1",
            slug: "p-1",
            order: 0,
            detailPageId: "page-1",
          };

          const result = validate(product, productSchema);
          const withinBounds = nameLen <= 120 && descLen <= 300;

          expect(result.ok).toBe(withinBounds);
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });

  it("accepts a case study iff name <= 120, description <= 300, and image.alt within 1..125 when present", () => {
    fc.assert(
      fc.property(
        // name length straddling 120
        fc.integer({ min: 0, max: 130 }),
        // description length straddling 300
        fc.integer({ min: 0, max: 320 }),
        // alt length: 0 => image omitted; otherwise straddles [1, 125]
        fc.integer({ min: 0, max: 135 }),
        (nameLen, descLen, altLen) => {
          const caseStudy = makeCaseStudy(nameLen, descLen, altLen);

          const result = validate(caseStudy, caseStudySchema);

          const nameOk = nameLen <= 120;
          const descOk = descLen <= 300;
          // When altLen === 0 the image is absent, so no alt bound applies.
          // When present, alt must be within 1..125 (altLen is >= 1 here).
          const altOk = altLen === 0 || (altLen >= 1 && altLen <= 125);
          const withinBounds = nameOk && descOk && altOk;

          expect(result.ok).toBe(withinBounds);
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });

  it("accepts a service offering iff name <= 120 and description within 80..600", () => {
    fc.assert(
      fc.property(
        // name length straddling 120
        fc.integer({ min: 0, max: 130 }),
        // description length straddling [80, 600]
        fc.integer({ min: 0, max: 610 }),
        (nameLen, descLen) => {
          const offering = {
            name: stringOfLength(nameLen),
            description: stringOfLength(descLen),
            id: "s1",
            order: 0,
          };
          // Wrap in a valid single-offering ServicesPage so the only cause of
          // rejection is the offering-field bound under test.
          const doc = { offerings: [offering] };

          const result = validate(doc, servicesPageSchema);
          const withinBounds =
            nameLen <= 120 && descLen >= 80 && descLen <= 600;

          expect(result.ok).toBe(withinBounds);
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });

  it("accepts a content-image alt (on a case study) iff within 1..125", () => {
    fc.assert(
      fc.property(
        // alt length straddling [1, 125]; here the image is ALWAYS present.
        fc.integer({ min: 0, max: 135 }),
        (altLen) => {
          const caseStudy: Record<string, unknown> = {
            name: "A case study",
            description: "A summary.",
            clientName: "Acme",
            clientSiteUrl: "https://example.com",
            engagementRole: "Design and implementation consultancy.",
            deliverable: "An end-to-end platform.",
            sections: allFourSections(),
            id: "cs1",
            slug: "cs-1",
            order: 0,
            detailPageId: "page-cs-1",
            // Image is always present; alt of exactly `altLen` chars.
            image: { src: "/img/cs.png", alt: stringOfLength(altLen) },
          };

          const result = validate(caseStudy, caseStudySchema);
          const withinBounds = altLen >= 1 && altLen <= 125;

          expect(result.ok).toBe(withinBounds);
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });

  it("jointly: authored content is accepted iff ALL declared bounds hold", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 130 }), // product name length
        fc.integer({ min: 0, max: 320 }), // product description length
        fc.integer({ min: 0, max: 130 }), // case-study name length
        fc.integer({ min: 0, max: 320 }), // case-study description length
        fc.integer({ min: 0, max: 135 }), // case-study image.alt length (0 => omitted)
        fc.integer({ min: 0, max: 130 }), // service name length
        fc.integer({ min: 0, max: 610 }), // service description length
        (
          prodNameLen,
          prodDescLen,
          csNameLen,
          csDescLen,
          csAltLen,
          svcNameLen,
          svcDescLen,
        ) => {
          const product = {
            name: stringOfLength(prodNameLen),
            description: stringOfLength(prodDescLen),
            id: "p1",
            slug: "p-1",
            order: 0,
            detailPageId: "page-1",
          };
          const caseStudy = makeCaseStudy(csNameLen, csDescLen, csAltLen);
          const servicesDoc = {
            offerings: [
              {
                name: stringOfLength(svcNameLen),
                description: stringOfLength(svcDescLen),
                id: "s1",
                order: 0,
              },
            ],
          };

          const productOk = validate(product, productSchema).ok;
          const caseStudyOk = validate(caseStudy, caseStudySchema).ok;
          const servicesOk = validate(servicesDoc, servicesPageSchema).ok;

          const productBoundsHold = prodNameLen <= 120 && prodDescLen <= 300;
          const caseStudyBoundsHold =
            csNameLen <= 120 &&
            csDescLen <= 300 &&
            (csAltLen === 0 || (csAltLen >= 1 && csAltLen <= 125));
          const servicesBoundsHold =
            svcNameLen <= 120 && svcDescLen >= 80 && svcDescLen <= 600;

          expect(productOk).toBe(productBoundsHold);
          expect(caseStudyOk).toBe(caseStudyBoundsHold);
          expect(servicesOk).toBe(servicesBoundsHold);
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });
});

/**
 * Feature: corporate-site-positioning, Property 9: Services offering cardinality
 *
 * For any Services document, validation accepts it exactly when it has between 1
 * and 20 Service_Offering entries inclusive, and rejects documents with 0 or
 * more than 20.
 *
 * Validates: Requirements 3.1
 *
 * Strategy: generate a ServicesPage with a count of otherwise-valid offerings
 * straddling the [1, 20] cardinality boundary (0 up to 25) so the ONLY thing
 * that can cause rejection is the offering count. Each offering is fully valid
 * (name/description within bounds, required internal keys present), isolating
 * the `offerings` minItems/maxItems bound as the cause of accept/reject.
 */

/** Build a single fully-valid Service_Offering with a unique id/order. */
function makeOffering(i: number) {
  return {
    name: `Service ${i}`,
    // Description is comfortably within the 80..600 bound.
    description:
      "Cadocary designs and implements custom software end to end for this " +
      "offering, delivering working outcomes for the client organization.",
    id: `service-${i}`,
    order: i,
  };
}

describe("Feature: corporate-site-positioning, Property 9: Services offering cardinality", () => {
  it("accepts a ServicesPage iff it has 1..20 offerings, rejects 0 or > 20", () => {
    fc.assert(
      fc.property(
        // offering count straddling [1, 20]
        fc.integer({ min: 0, max: 25 }),
        (count) => {
          const offerings = Array.from({ length: count }, (_, i) =>
            makeOffering(i),
          );
          const doc = { offerings };

          const result = validate(doc, servicesPageSchema);
          const withinBounds = count >= 1 && count <= 20;

          expect(result.ok).toBe(withinBounds);
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });
});
