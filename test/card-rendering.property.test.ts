import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { productCard, projectCard } from "../src/domain/cards";
import { resolveRoute } from "../src/domain/router";
import type { IA, Product, Project } from "../src/types";

/**
 * Feature: website-redesign, Property 12: Cards render all required fields and a detail link
 *
 * For any product or project, the rendered card contains its `name`, its
 * `description`, and a link whose target resolves to that item's detail page.
 *
 * Validates: Requirements 5.2, 6.2
 *
 * Strategy: testing the Astro card components directly is heavy and would pull in
 * a DOM/render harness, so we instead test the PURE rendering-relevant derivation
 * the cards rely on (`productCard` / `projectCard` in src/domain/cards.ts). Those
 * helpers compute the exact same fields the components put on the page: `name`,
 * `description`, and the detail `href` (`/products/{slug}` / `/projects/{slug}`).
 *
 * For the "link resolves to that item's detail page" clause we go beyond a string
 * comparison: we feed the card's `href` into the real `resolveRoute` together with
 * a minimal catalog that contains exactly this item, and assert the route resolves
 * back to the SAME item (matched by slug/id). This ties the card's link to the
 * actual routing contract rather than a hard-coded expectation.
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

/** name: <= 120 chars per the content model; allow the full unicode range. */
const nameArb = fc.string({ minLength: 0, maxLength: 120 });
/** description: <= 300 chars per the content model. */
const descriptionArb = fc.string({ minLength: 0, maxLength: 300 });

const productArb: fc.Arbitrary<Product> = fc.record({
  name: nameArb,
  description: descriptionArb,
  id: fc.string({ minLength: 1, maxLength: 12 }),
  slug: slugArb,
  order: fc.integer({ min: 0, max: 1000 }),
  detailPageId: fc.string({ minLength: 1, maxLength: 12 }),
});

const projectArb: fc.Arbitrary<Project> = fc.record({
  name: nameArb,
  description: descriptionArb,
  dateCreated: fc.constantFrom(
    "2024-01-15",
    "2023-11-02",
    "2025-06-30",
  ),
  id: fc.string({ minLength: 1, maxLength: 12 }),
  slug: slugArb,
  detailPageId: fc.string({ minLength: 1, maxLength: 12 }),
});

/** An empty IA — detail routes are backed by the catalogs, not the IA. */
const EMPTY_IA: IA = { defaultSectionId: "main", sections: [] };

describe("Property 12: Cards render all required fields and a detail link", () => {
  it("product card exposes name, description, and a link resolving to the product's detail page", () => {
    fc.assert(
      fc.property(productArb, (product) => {
        const card = productCard(product);

        // Required fields are preserved verbatim (Requirement 5.2).
        expect(card.name).toBe(product.name);
        expect(card.description).toBe(product.description);

        // The link target is the product's detail path.
        expect(card.href).toBe(`/products/${product.slug}`);

        // ...and that target actually resolves to THIS product via the real
        // routing contract, using a minimal catalog containing just this item.
        const result = resolveRoute(card.href, EMPTY_IA, [product], []);
        expect(result.kind).toBe("product");
        if (result.kind === "product") {
          expect(result.product.slug).toBe(product.slug);
          expect(result.product.id).toBe(product.id);
        }
      }),
      { numRuns: MIN_ITERATIONS },
    );
  });

  it("project card exposes name, description, and a link resolving to the project's detail page", () => {
    fc.assert(
      fc.property(projectArb, (project) => {
        const card = projectCard(project);

        // Required fields are preserved verbatim (Requirement 6.2).
        expect(card.name).toBe(project.name);
        expect(card.description).toBe(project.description);

        // The link target is the project's detail path.
        expect(card.href).toBe(`/projects/${project.slug}`);

        // ...and that target resolves to THIS project via the real routing
        // contract, using a minimal catalog containing just this item.
        const result = resolveRoute(card.href, EMPTY_IA, [], [project]);
        expect(result.kind).toBe("project");
        if (result.kind === "project") {
          expect(result.project.slug).toBe(project.slug);
          expect(result.project.id).toBe(project.id);
        }
      }),
      { numRuns: MIN_ITERATIONS },
    );
  });
});
