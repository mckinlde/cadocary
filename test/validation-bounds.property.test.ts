import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  validate,
  productSchema,
  projectSchema,
  slideDeckSchema,
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
