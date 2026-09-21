import { describe, it, expect } from "vitest";
import fc from "fast-check";

import productsSeed from "../src/content/products.json";
import caseStudiesSeed from "../src/content/caseStudies.json";

/**
 * Feature: corporate-site-positioning, Property 6: Products and case studies are
 * disjoint collections
 *
 * For any authored `products` list and `caseStudies` list, the set of product
 * ids and the set of case-study ids are disjoint, so every presented engagement
 * appears in exactly one of the Product_Catalog or the Case_Study_Collection.
 *
 * Validates: Requirements 2.3
 *
 * Strategy:
 *   - Generated: draw two lists of entities carrying `id`s from a small shared
 *     id pool so overlaps are COMMON (the disjointness property is meaningful
 *     only when collisions are actually generated). We compute the derived
 *     disjointness the same way the presentation layer must — by comparing the
 *     two id sets — and assert it exactly agrees with a from-scratch overlap
 *     check. This pins down that "disjoint collections" means "no shared id".
 *   - Real seed: import the shipped products.json and caseStudies.json and
 *     assert their id sets share no member, so the two collections partition the
 *     presented engagements as required.
 */

const MIN_ITERATIONS = 100;

/**
 * The disjointness derivation under test: two collections identified by `id`
 * are disjoint iff no id appears in both. This is the checkable rule the
 * Product_Catalog / Case_Study_Collection split must satisfy (Requirement 2.3).
 */
function areDisjointById(
  products: ReadonlyArray<{ id: string }>,
  caseStudies: ReadonlyArray<{ id: string }>,
): boolean {
  const productIds = new Set(products.map((p) => p.id));
  return caseStudies.every((c) => !productIds.has(c.id));
}

describe("Feature: corporate-site-positioning, Property 6: Products and case studies are disjoint collections", () => {
  // A small shared id pool so the two generated lists frequently collide,
  // exercising BOTH the disjoint and the overlapping cases.
  const idPool = fc.constantFrom("a", "b", "c", "d", "e", "f", "g", "h");

  // Each entity carries only what disjointness depends on: its `id`. Within a
  // single collection ids are de-duplicated (a real collection has unique ids);
  // across collections they may overlap, which is exactly what we test.
  const collection = fc
    .array(fc.record({ id: idPool }), { minLength: 0, maxLength: 8 })
    .map((items) => {
      const seen = new Set<string>();
      return items.filter((it) => {
        if (seen.has(it.id)) return false;
        seen.add(it.id);
        return true;
      });
    });

  it("treats products and case studies as disjoint exactly when no id is shared", () => {
    fc.assert(
      fc.property(collection, collection, (products, caseStudies) => {
        const derived = areDisjointById(products, caseStudies);

        // Independent from-scratch overlap check as the source of truth.
        const productIds = new Set(products.map((p) => p.id));
        const caseStudyIds = new Set(caseStudies.map((c) => c.id));
        const shared = [...caseStudyIds].filter((id) => productIds.has(id));
        const trulyDisjoint = shared.length === 0;

        expect(derived).toBe(trulyDisjoint);
      }),
      { numRuns: MIN_ITERATIONS },
    );
  });

  it("holds for any product list against a disjoint case-study list (constructed disjoint stays disjoint)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 6 }), {
          minLength: 0,
          maxLength: 10,
        }),
        (rawIds) => {
          const productIds = [...new Set(rawIds)];
          // Construct case-study ids guaranteed NOT to collide by prefixing.
          const products = productIds.map((id) => ({ id: `prod-${id}` }));
          const caseStudies = productIds.map((id) => ({ id: `case-${id}` }));

          expect(areDisjointById(products, caseStudies)).toBe(true);
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });
});

describe("Feature: corporate-site-positioning, Property 6: real seed content is partitioned", () => {
  it("the shipped products.json and caseStudies.json share no ids", () => {
    const products = productsSeed as ReadonlyArray<{ id: string }>;
    const caseStudies = caseStudiesSeed as ReadonlyArray<{ id: string }>;

    // Sanity: both collections have their own internally-unique ids.
    const productIds = products.map((p) => p.id);
    const caseStudyIds = caseStudies.map((c) => c.id);
    expect(new Set(productIds).size).toBe(productIds.length);
    expect(new Set(caseStudyIds).size).toBe(caseStudyIds.length);

    // The partition invariant: no id appears in both collections.
    const productIdSet = new Set(productIds);
    const overlap = caseStudyIds.filter((id) => productIdSet.has(id));
    expect(overlap).toEqual([]);
    expect(areDisjointById(products, caseStudies)).toBe(true);
  });
});
