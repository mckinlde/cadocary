import { describe, expect, test } from "vitest";
import fc from "fast-check";

import { orderProjects } from "../src/domain/ordering";
import type { Project } from "../src/types";

/**
 * Feature: website-redesign, Property 11: Project ordering is a recency permutation
 *
 * Validates: Requirements 6.1
 *
 * For any set of projects, `orderProjects` returns a permutation containing
 * exactly the same projects (same `id` multiset), ordered so that for every
 * adjacent pair the earlier one has a `dateCreated` >= the later one — i.e.
 * most-recently-added first — with ties broken deterministically by ascending
 * `id`. The function is deterministic and does not mutate its input.
 */
describe("Property 11: Project ordering is a recency permutation", () => {
  // Compose a valid ISO 8601 timestamp from a small set of date/time parts.
  // Deliberately drawn from a constrained space (limited days/hours) so that
  // duplicate `dateCreated` values occur frequently, exercising the id tie-break.
  const isoDateCreated = fc
    .record({
      year: fc.integer({ min: 2018, max: 2024 }),
      month: fc.integer({ min: 1, max: 12 }),
      day: fc.integer({ min: 1, max: 28 }),
      hour: fc.integer({ min: 0, max: 4 }),
      minute: fc.integer({ min: 0, max: 5 }),
    })
    .map(({ year, month, day, hour, minute }) => {
      const p = (n: number, width = 2) => String(n).padStart(width, "0");
      // e.g. "2021-07-09T03:04:00Z" — lexicographically sortable ISO 8601.
      return `${p(year, 4)}-${p(month)}-${p(day)}T${p(hour)}:${p(minute)}:00Z`;
    });

  // A single project carrying only the fields ordering depends on (plus the
  // required shape). `id` is assigned uniquely after generation.
  const projectBody = fc.record({
    name: fc.string({ maxLength: 120 }),
    description: fc.string({ maxLength: 300 }),
    dateCreated: isoDateCreated,
    slug: fc.string(),
    detailPageId: fc.string(),
  });

  // An array of projects with UNIQUE ids (so a permutation check by id is exact)
  // but freely repeated `dateCreated` values (to exercise the id tie-break).
  const projects = fc
    .array(projectBody, { minLength: 0, maxLength: 30 })
    .map((bodies): Project[] =>
      bodies.map((b, index) => ({ ...b, id: `project-${index}` })),
    );

  test("orderProjects is a deterministic, non-mutating recency permutation", () => {
    fc.assert(
      fc.property(projects, (input) => {
        // Snapshot the input to later prove it was not mutated.
        const before = input.map((p) => ({ ...p }));

        const result = orderProjects(input);

        // (1) Permutation of the input: same id multiset, same length.
        expect(result).toHaveLength(input.length);
        const inputIds = input.map((p) => p.id).sort();
        const resultIds = result.map((p) => p.id).sort();
        expect(resultIds).toEqual(inputIds);

        // (2) Ordering: for every adjacent pair, the earlier one is >= the later
        //     one by dateCreated (descending); ties are broken by ascending id.
        for (let i = 0; i + 1 < result.length; i++) {
          const earlier = result[i];
          const later = result[i + 1];
          if (earlier.dateCreated === later.dateCreated) {
            // Same date -> id must be strictly ascending (ids are unique here).
            expect(earlier.id < later.id).toBe(true);
          } else {
            // Different dates -> the earlier slot must hold the more recent date.
            expect(earlier.dateCreated > later.dateCreated).toBe(true);
          }
        }

        // (3) Determinism: ordering the same input again yields an identical
        //     sequence of ids.
        const again = orderProjects(input);
        expect(again.map((p) => p.id)).toEqual(result.map((p) => p.id));

        // (4) Input not mutated: contents and order unchanged.
        expect(input).toEqual(before);
      }),
      { numRuns: 200 },
    );
  });
});
