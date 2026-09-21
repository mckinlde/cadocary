import { describe, expect, test } from "vitest";
import fc from "fast-check";

import { buildNavModel } from "../src/domain/ia-derivation";
import type { IA, PageRef, Section } from "../src/types";

/**
 * Feature: website-redesign, Property 1: Navigation derivation mirrors the Information Architecture
 *
 * Validates: Requirements 1.2, 2.1, 2.5
 *
 * For any valid IA, buildNavModel produces top-level items that correspond
 * one-to-one with the nav-visible sections of the IA (sections having >= 1
 * nav-visible page), preserving section order; a section with EXACTLY ONE
 * nav-visible page yields a `link` item pointing to that page's path, and a
 * section with TWO OR MORE nav-visible pages yields a `menu` item whose children
 * are exactly those nav-visible pages, in section page order.
 *
 * Strategy: we build a structurally valid IA with globally unique page ids and
 * paths (so the one-to-one correspondence and the link target are unambiguous),
 * with sections holding 0..N pages. Each page's `showInNav` is drawn as
 * true / false / undefined so we exercise the default-true behavior AND explicit
 * hiding — including sections that end up with zero nav-visible pages (which must
 * contribute NO nav item) and sections whose nav-visible count crosses the
 * link-vs-menu boundary purely due to hidden pages.
 */

const MIN_ITERATIONS = 100;

/**
 * showInNav variants: `undefined` (omitted -> defaults to true), explicit true,
 * and explicit false. Weighted toward including some `false` so visibility
 * filtering is genuinely exercised.
 */
const showInNavArb = fc.constantFrom<boolean | undefined>(
  undefined,
  true,
  false,
);

/**
 * Build a valid IA from a nested description of sections. We assign globally
 * unique page ids (`p0`, `p1`, ...) and unique paths (`/p0`, `/p1`, ...) across
 * the whole IA by using a running counter, so ids/paths never collide regardless
 * of how pages are distributed across sections. `showInNav` may be undefined,
 * true, or false to exercise the default-true rule and explicit hiding.
 */
type SectionSpec = { showInNavFlags: (boolean | undefined)[] };

function makeIA(sectionSpecs: SectionSpec[]): IA {
  let pageCounter = 0;
  const sections: Section[] = sectionSpecs.map((spec, sIdx) => {
    const pages: PageRef[] = spec.showInNavFlags.map((showInNav) => {
      const n = pageCounter++;
      const page: PageRef = {
        id: `p${n}`,
        label: `Page ${n}`,
        path: `/p${n}`,
      };
      if (showInNav !== undefined) {
        page.showInNav = showInNav;
      }
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
    defaultSectionId: sections.length > 0 ? sections[0].id : "s0",
    sections,
  };
}

/** Arbitrary valid IA: 0..6 sections, each with 0..5 pages. */
const iaArb: fc.Arbitrary<IA> = fc
  .array(
    fc.record<SectionSpec>({
      showInNavFlags: fc.array(showInNavArb, { minLength: 0, maxLength: 5 }),
    }),
    { minLength: 0, maxLength: 6 },
  )
  .map(makeIA);

/** A page is nav-visible unless it explicitly sets showInNav === false. */
const isNavVisible = (p: PageRef): boolean => p.showInNav !== false;

describe("Property 1: Navigation derivation mirrors the Information Architecture", () => {
  test("nav items correspond one-to-one with nav-visible sections (in order) with correct link/menu items", () => {
    fc.assert(
      fc.property(iaArb, (ia) => {
        const model = buildNavModel(ia);

        // The expected nav-visible sections, in the SAME order as the IA, are
        // exactly those sections that have >= 1 nav-visible page.
        const navVisibleSections = ia.sections.filter(
          (s) => s.pages.filter(isNavVisible).length >= 1,
        );

        // 1) One-to-one correspondence, preserving section order.
        expect(model.items).toHaveLength(navVisibleSections.length);

        for (let i = 0; i < navVisibleSections.length; i++) {
          const section = navVisibleSections[i];
          const item = model.items[i];
          const navPages = section.pages.filter(isNavVisible);

          // Every nav item carries the section's human-readable label.
          expect(item.label).toBe(section.label);

          if (navPages.length === 1) {
            // 2) Exactly one nav-visible page -> a `link` item pointing at that
            //    page's path.
            expect(item.kind).toBe("link");
            if (item.kind === "link") {
              expect(item.pageId).toBe(navPages[0].id);
              expect(item.path).toBe(navPages[0].path);
            }
          } else {
            // 3) Two or more nav-visible pages -> a `menu` item whose children
            //    are exactly those pages, in section page order.
            expect(navPages.length).toBeGreaterThanOrEqual(2);
            expect(item.kind).toBe("menu");
            if (item.kind === "menu") {
              expect(item.sectionId).toBe(section.id);
              expect(item.children).toHaveLength(navPages.length);
              for (let j = 0; j < navPages.length; j++) {
                expect(item.children[j].pageId).toBe(navPages[j].id);
                expect(item.children[j].path).toBe(navPages[j].path);
                expect(item.children[j].label).toBe(navPages[j].label);
              }
            }
          }
        }

        // 4) A section with zero nav-visible pages contributes no item: the
        //    total item count never exceeds the total section count, and equals
        //    only the nav-visible ones (already asserted). Sanity re-check:
        const sectionsWithNoNavPages = ia.sections.filter(
          (s) => s.pages.filter(isNavVisible).length === 0,
        );
        expect(model.items.length).toBe(
          ia.sections.length - sectionsWithNoNavPages.length,
        );
      }),
      { numRuns: MIN_ITERATIONS },
    );
  });
});
