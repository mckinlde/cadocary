import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { getActiveSection } from "../src/domain/ia-derivation";
import type { IA, PageRef, Section } from "../src/types";

/**
 * Feature: website-redesign, Property 5: Active-section computation matches the owning section
 *
 * Validates: Requirements 1.7
 *
 * For any valid IA and any page in it, the computed active top-level section for
 * that page equals the section that contains the page. `getActiveSection`
 * supports two lookup modes — by page `id` (default) and by `path` — and both
 * must resolve to the same owning section. Additionally, an id/path that is not
 * present anywhere in the IA must yield `undefined` (no current-section
 * indicator), matching the documented behavior for detail/parameterized routes.
 */

const MIN_ITERATIONS = 100;

/**
 * Strategy — a valid-IA generator.
 *
 * We generate a globally-unique pool of integer keys and partition it across a
 * number of sections. Each key `k` becomes a page with id `page-<k>` and path
 * `/p-<k>`, so ids and paths are unique IA-wide and every page lives in exactly
 * one section (the invariant that makes the owning section unambiguous). Because
 * the keys are drawn once and then split, no page can appear in two sections.
 */
type BuiltIA = {
  ia: IA;
  /** Flat list of (page, owning-section-id) pairs for easy sampling. */
  entries: { page: PageRef; sectionId: string }[];
  /** All page ids present in the IA (for the not-present case). */
  ids: Set<string>;
  /** All page paths present in the IA (for the not-present case). */
  paths: Set<string>;
};

// A section may be empty; the IA always has at least one section. We build from
// a list of section "buckets", each bucket being a list of unique page keys.
const iaArb: fc.Arbitrary<BuiltIA> = fc
  .uniqueArray(fc.integer({ min: 0, max: 100000 }), {
    minLength: 0,
    maxLength: 30,
  })
  .chain((keys) =>
    // Choose how many sections to spread these pages across (1..6). Then assign
    // each key to a section bucket by index modulo the section count, which keeps
    // every page in exactly one section while allowing some empty sections.
    fc.integer({ min: 1, max: 6 }).map((sectionCount) => {
      const buckets: number[][] = Array.from(
        { length: sectionCount },
        () => [],
      );
      keys.forEach((k, i) => {
        buckets[i % sectionCount].push(k);
      });

      const entries: BuiltIA["entries"] = [];
      const ids = new Set<string>();
      const paths = new Set<string>();

      const sections: Section[] = buckets.map((bucket, s) => {
        const sectionId = `section-${s}`;
        const pages: PageRef[] = bucket.map((k) => {
          const page: PageRef = {
            id: `page-${k}`,
            label: `Page ${k}`,
            path: `/p-${k}`,
          };
          ids.add(page.id);
          paths.add(page.path);
          entries.push({ page, sectionId });
          return page;
        });
        return { id: sectionId, label: `Section ${s}`, order: s, pages };
      });

      const ia: IA = { defaultSectionId: "section-0", sections };
      return { ia, entries, ids, paths };
    }),
  );

describe("Property 5: Active-section computation matches the owning section", () => {
  it("getActiveSection returns the owning section for any page, by id and by path", () => {
    fc.assert(
      fc.property(
        iaArb,
        fc.double({ min: 0, max: 1, noNaN: true }),
        ({ ia, entries }, pick) => {
          // If the IA has no pages, there is nothing to look up; the property is
          // vacuously satisfied for that shape.
          fc.pre(entries.length > 0);

          // Deterministically choose a page that IS in the IA.
          const index = Math.min(
            entries.length - 1,
            Math.floor(pick * entries.length),
          );
          const { page, sectionId } = entries[index];

          // Lookup by id (default mode) must return the owning section.
          const byId = getActiveSection(ia, page.id);
          expect(byId).toBeDefined();
          expect(byId?.id).toBe(sectionId);

          // Lookup by id, explicit mode, agrees.
          const byIdExplicit = getActiveSection(ia, page.id, "id");
          expect(byIdExplicit?.id).toBe(sectionId);

          // Lookup by path must return the SAME owning section.
          const byPath = getActiveSection(ia, page.path, "path");
          expect(byPath).toBeDefined();
          expect(byPath?.id).toBe(sectionId);

          // The returned section actually contains the page (sanity: the owning
          // section's page list includes this id/path).
          expect(byId?.pages.some((p) => p.id === page.id)).toBe(true);
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });

  it("getActiveSection returns undefined for ids/paths not present in the IA", () => {
    fc.assert(
      fc.property(
        iaArb,
        fc.string({ minLength: 1, maxLength: 12 }),
        ({ ia, ids, paths }, token) => {
          // Construct an id and a path guaranteed not to exist in the IA by
          // using a prefix the generator never produces.
          const missingId = `missing-id-${token}`;
          const missingPath = `/missing-${token}`;
          fc.pre(!ids.has(missingId));
          fc.pre(!paths.has(missingPath));

          expect(getActiveSection(ia, missingId, "id")).toBeUndefined();
          expect(getActiveSection(ia, missingPath, "path")).toBeUndefined();
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });
});
