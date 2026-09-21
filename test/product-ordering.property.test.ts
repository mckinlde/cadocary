import { describe, expect, test } from "vitest";
import fc from "fast-check";

import { orderProducts } from "../src/domain/ordering";
import type { Product } from "../src/types";

/**
 * Feature: website-redesign, Property 10: Product ordering is a stable permutation
 *
 * Validates: Requirements 5.1
 *
 * For any set of products, orderProducts returns a permutation containing
 * exactly the same products (same multiset), deterministically ordered by
 * ascending `order` then by `id`.
 */
describe("Property 10: Product ordering is a stable permutation", () => {
  // Build a Product from an id and an order key. Only `id` and `order` drive the
  // sort; the remaining fields are filler that satisfies the Product shape.
  const productFrom = (id: string, order: number): Product => ({
    name: `Product ${id}`,
    description: `Description for ${id}`,
    id,
    slug: `slug-${id}`,
    order,
    detailPageId: `page-${id}`,
  });

  // Generate a list of products with UNIQUE ids (so the multiset comparison and
  // the deterministic id tie-break are unambiguous). The `order` values are drawn
  // from a small range so duplicate `order` values are common — this exercises
  // the ascending-`id` tie-break.
  const productsGen = fc
    .uniqueArray(fc.string({ minLength: 1, maxLength: 6 }), {
      minLength: 0,
      maxLength: 30,
    })
    .chain((ids) =>
      fc
        .array(fc.integer({ min: -5, max: 5 }), {
          minLength: ids.length,
          maxLength: ids.length,
        })
        .map((orders) => ids.map((id, i) => productFrom(id, orders[i]))),
    );

  test("output is a same-multiset permutation, sorted by (order asc, id asc), deterministic, and non-mutating", () => {
    fc.assert(
      fc.property(productsGen, (products) => {
        // Snapshot the input to later assert it was not mutated.
        const inputSnapshot = products.map((p) => ({ ...p }));

        const result = orderProducts(products);

        // 1) Permutation / same multiset: compare by id multiset (ids are unique
        //    here, so sorted id arrays must be equal).
        const inputIds = products.map((p) => p.id).sort();
        const resultIds = result.map((p) => p.id).sort();
        expect(resultIds).toEqual(inputIds);
        expect(result).toHaveLength(products.length);

        // 2) Sorted by (order asc, then id asc) for every adjacent pair.
        for (let i = 1; i < result.length; i++) {
          const prev = result[i - 1];
          const curr = result[i];
          const ordered =
            prev.order < curr.order ||
            (prev.order === curr.order && prev.id <= curr.id);
          expect(ordered).toBe(true);
        }

        // 3) Determinism: calling twice yields an equal result.
        const again = orderProducts(products);
        expect(again).toEqual(result);

        // 4) Input array is not mutated (same length, same elements, same order).
        expect(products).toEqual(inputSnapshot);
      }),
      { numRuns: 200 },
    );
  });
});
