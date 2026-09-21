import { describe, expect, test } from "vitest";
import fc from "fast-check";

import { orderCaseStudies } from "../src/domain/ordering";
import type { CaseStudy, CaseStudySection } from "../src/types";

/**
 * Feature: corporate-site-positioning, Property 11: Case_Study ordering is a
 * date-free stable permutation
 *
 * Validates: Requirements 4.6
 *
 * Migrated (not weakened) from the old `project-ordering.property.test.ts`. The
 * new invariant is stronger and cleaner: it is DATE-FREE. For any list of case
 * studies, `orderCaseStudies` returns a permutation containing exactly the same
 * multiset (by `id`), deterministically ordered by ascending `order` then
 * ascending `id`, using NO publication-date field. The function does not mutate
 * its input and is deterministic (calling twice yields an identical order).
 */
describe("Property 11: Case_Study ordering is a date-free stable permutation", () => {
  // The four fixed section kinds, exposed in the canonical order. Ordering does
  // not depend on sections, but the generated object must satisfy the type, so
  // we build the required four-section structure with minimal valid bodies.
  const sections: CaseStudySection[] = [
    { kind: "problem", body: [{ type: "paragraph", text: "p" }] },
    { kind: "approach", body: [{ type: "paragraph", text: "a" }] },
    { kind: "whatWasBuilt", body: [{ type: "paragraph", text: "b" }] },
    { kind: "outcome", body: [{ type: "paragraph", text: "o" }] },
  ];

  // A single case study carrying only the fields ordering depends on (`order`
  // and `id`, the latter assigned uniquely after generation) plus minimal valid
  // values for the other required fields so the object satisfies `CaseStudy`.
  // `order` is drawn from a SMALL range so duplicate orders are common, which
  // exercises the id tie-break. Crucially, there is NO date field anywhere.
  const caseStudyBody = fc.record({
    name: fc.string({ maxLength: 120 }),
    description: fc.string({ maxLength: 300 }),
    // Small range -> frequent duplicate `order` values -> exercises id tie-break.
    order: fc.integer({ min: 0, max: 4 }),
    clientName: fc.string(),
    clientSiteUrl: fc.webUrl(),
    engagementRole: fc.string(),
    deliverable: fc.string(),
    slug: fc.string(),
    detailPageId: fc.string(),
  });

  // An array of case studies with UNIQUE ids (so a permutation check by id is
  // exact) but freely repeated `order` values (to exercise the id tie-break).
  const caseStudies = fc
    .array(caseStudyBody, { minLength: 0, maxLength: 30 })
    .map((bodies): CaseStudy[] =>
      bodies.map((b, index) => ({
        ...b,
        id: `case-study-${index}`,
        sections,
      })),
    );

  test("orderCaseStudies is a deterministic, non-mutating, date-free permutation", () => {
    fc.assert(
      fc.property(caseStudies, (input) => {
        // Snapshot the input to later prove it was not mutated.
        const before = input.map((c) => ({ ...c }));

        const result = orderCaseStudies(input);

        // (1) Permutation of the input: same id multiset, same length.
        expect(result).toHaveLength(input.length);
        const inputIds = input.map((c) => c.id).sort();
        const resultIds = result.map((c) => c.id).sort();
        expect(resultIds).toEqual(inputIds);

        // (2) Ordering: for every adjacent pair, `order` is non-decreasing
        //     (ascending); ties on `order` are broken by ascending `id`.
        for (let i = 0; i + 1 < result.length; i++) {
          const earlier = result[i];
          const later = result[i + 1];
          if (earlier.order === later.order) {
            // Same order -> id must be strictly ascending (ids are unique here).
            expect(earlier.id < later.id).toBe(true);
          } else {
            // Different order -> the earlier slot must hold the smaller order.
            expect(earlier.order < later.order).toBe(true);
          }
        }

        // (3) Determinism: ordering the same input again yields an identical
        //     sequence of ids.
        const again = orderCaseStudies(input);
        expect(again.map((c) => c.id)).toEqual(result.map((c) => c.id));

        // (4) Input not mutated: contents and order unchanged.
        expect(input).toEqual(before);
      }),
      { numRuns: 200 },
    );
  });
});
