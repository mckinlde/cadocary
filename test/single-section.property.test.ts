import { describe, expect, test } from "vitest";
import fc from "fast-check";

import { checkIaIntegrity } from "../src/domain/content-loader";
import type { IA, PageRef, Section } from "../src/types";

/**
 * Feature: website-redesign, Property 3: Every page belongs to exactly one section
 *
 * Validates: Requirements 2.2
 *
 * For any valid IA, each page id appears in exactly one section's page list.
 *
 * This invariant is GUARANTEED by the content model: `checkIaIntegrity` (the IA
 * cross-document integrity check) enforces that every `PageRef.id` is unique
 * across the whole IA — a duplicated id would place a page in two sections. So a
 * valid IA (one that passes the integrity check) necessarily has each page id in
 * exactly one section.
 *
 * Strategy:
 *  - Build a structurally valid IA with GLOBALLY UNIQUE page ids and paths,
 *    partitioned across 0..6 sections (each holding 0..5 pages), assigned from a
 *    running counter so ids/paths never collide however pages are distributed.
 *  - Positive property: for each page id, the count of sections whose page list
 *    contains that id is exactly 1 (and the flattened id list has no duplicates).
 *    We also assert `checkIaIntegrity` accepts the IA, tying the property to the
 *    real integrity check that guarantees it.
 *  - Negative guard: deliberately duplicate a page id across two sections and
 *    assert `checkIaIntegrity` rejects it (ok === false) — proving the
 *    single-section invariant is genuinely ENFORCED, not merely assumed.
 */

const MIN_ITERATIONS = 100;

/** Build a valid IA whose page ids/paths are globally unique via a counter. */
function makeIA(sectionPageCounts: number[]): IA {
  let counter = 0;
  const sections: Section[] = sectionPageCounts.map((pageCount, sIdx) => {
    const pages: PageRef[] = Array.from({ length: pageCount }, () => {
      const n = counter++;
      const page: PageRef = {
        id: `p${n}`,
        label: `Page ${n}`,
        path: `/p${n}`,
      };
      return page;
    });
    return {
      id: `s${sIdx}`,
      label: `Section ${sIdx}`,
      order: sIdx,
      pages,
    };
  });

  return {
    // Reference a real section (or a stable placeholder for the empty IA) so the
    // integrity check's defaultSectionId constraint is satisfied.
    defaultSectionId: sections.length > 0 ? sections[0].id : "s0",
    sections,
  };
}

/**
 * Arbitrary valid IA: 1..6 sections, each with 0..5 pages. At least one section
 * so `defaultSectionId` always references a real section (otherwise the IA is
 * not valid — it would fail the integrity check's defaultSectionId constraint,
 * which is unrelated to the single-section invariant under test). The
 * single-section invariant holds vacuously for a section-less IA, so excluding
 * it loses no coverage. Sections may still hold zero pages.
 */
const iaArb: fc.Arbitrary<IA> = fc
  .array(fc.integer({ min: 0, max: 5 }), { minLength: 1, maxLength: 6 })
  .map(makeIA);

describe("Property 3: Every page belongs to exactly one section", () => {
  test("each page id appears in exactly one section's page list (and the IA is accepted)", () => {
    fc.assert(
      fc.property(iaArb, (ia) => {
        // The valid IA must pass the real integrity check that guarantees this.
        expect(checkIaIntegrity(ia).ok).toBe(true);

        // Collect all page ids across every section.
        const allIds = ia.sections.flatMap((s) => s.pages.map((p) => p.id));

        // For every distinct page id, exactly one section contains it.
        for (const id of new Set(allIds)) {
          const owningSections = ia.sections.filter((s) =>
            s.pages.some((p) => p.id === id),
          );
          expect(owningSections).toHaveLength(1);
        }

        // No id appears more than once anywhere (exactly-one across the whole IA).
        expect(new Set(allIds).size).toBe(allIds.length);
      }),
      { numRuns: MIN_ITERATIONS },
    );
  });

  test("negative guard: duplicating a page id across two sections is rejected by checkIaIntegrity", () => {
    fc.assert(
      // Need at least 2 sections and at least one page to duplicate.
      fc.property(
        fc
          .array(fc.integer({ min: 1, max: 5 }), { minLength: 2, maxLength: 6 })
          .map(makeIA),
        (ia) => {
          // Take a page id from the first section and copy it into a page in the
          // last section — placing that page id in two sections at once.
          const duplicatedId = ia.sections[0].pages[0].id;
          const lastSection = ia.sections[ia.sections.length - 1];

          const brokenIa: IA = {
            ...ia,
            sections: ia.sections.map((s) =>
              s === lastSection
                ? {
                    ...s,
                    pages: [
                      ...s.pages,
                      {
                        id: duplicatedId, // duplicate id -> two owning sections
                        label: "Duplicate",
                        path: `/duplicate-${duplicatedId}`, // keep path unique
                      },
                    ],
                  }
                : s,
            ),
          };

          const result = checkIaIntegrity(brokenIa);
          expect(result.ok).toBe(false);
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });
});
