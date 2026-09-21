import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { buildFooterDirectory } from "../src/domain/ia-derivation";
import type { IA, PageRef, Section } from "../src/types";

/**
 * Feature: website-redesign, Property 2: Footer directory mirrors the Information Architecture
 *
 * For any valid IA, `buildFooterDirectory(ia)` produces groups that correspond
 * one-to-one with the IA sections (in section order), where each footer-visible
 * page (`showInFooter !== false`) appears exactly once, in the group of the
 * section that owns it, with no missing and no extra pages, and each group's
 * label equals its section's human-readable `label` (never the machine `id`).
 *
 * Validates: Requirements 7.2, 7.3, 7.4, 7.7, 7.8
 *
 * Strategy: we generate a structurally valid IA — unique page ids and unique
 * paths across the whole IA, sections carrying zero or more pages. Some pages
 * are given `showInFooter: false` (and some `true`/omitted) to exercise the
 * footer-visibility filtering. Crucially, section `label` values are generated
 * to be DISTINCT from their `id` values (label is prefixed) so the test can
 * verify the group label is the human-readable `label` and never the machine
 * `id`. We then assert the one-to-one section correspondence (in order), the
 * label sourcing, and that footer-visible pages appear exactly once in their
 * owning group with no extras/missing.
 */

const MIN_ITERATIONS = 100;

/**
 * A single lowercase-alnum token used to build unique ids/paths. Uniqueness of
 * the underlying tokens (enforced by `uniqueArray`) guarantees unique page ids
 * and paths across the whole IA.
 */
const tokenArb = fc
  .stringMatching(/^[a-z][a-z0-9]{0,10}$/)
  .filter((s) => s.length > 0);

/**
 * `showInFooter` presence generator: exercises all three shapes the domain
 * treats as visible-by-default — omitted (undefined), explicit true, and
 * explicit false (hidden).
 */
const showInFooterArb = fc.constantFrom<boolean | undefined>(
  undefined,
  true,
  false,
);

/**
 * Build a valid IA from a list of section token-groups. Each inner array is the
 * set of unique page tokens for one section. Page ids and paths are derived from
 * a globally-incrementing counter so they are unique IA-wide regardless of how
 * tokens are distributed. Section labels are deliberately distinct from ids
 * (prefixed with "Label: ") so the test can distinguish label from id.
 */
function makeIA(
  sectionSpecs: { token: string; pages: { token: string; showInFooter: boolean | undefined }[] }[],
): IA {
  let counter = 0;
  const sections: Section[] = sectionSpecs.map((spec, sIdx) => {
    const pages: PageRef[] = spec.pages.map((p) => {
      const n = counter++;
      const page: PageRef = {
        id: `page-${n}-${p.token}`,
        label: `Page ${n}`,
        path: `/${spec.token}/${p.token}-${n}`,
      };
      if (p.showInFooter !== undefined) {
        page.showInFooter = p.showInFooter;
      }
      return page;
    });

    return {
      id: `sec-${sIdx}-${spec.token}`,
      // Human-readable label made intentionally different from the machine id.
      label: `Label: ${spec.token} ${sIdx}`,
      order: sIdx,
      pages,
    };
  });

  const defaultSectionId =
    sections.length > 0 ? sections[0].id : "sec-default";

  return { defaultSectionId, sections };
}

/** Arbitrary valid IA with unique page ids/paths and label != id. */
const iaArb: fc.Arbitrary<IA> = fc
  .array(
    fc.record({
      token: tokenArb,
      pages: fc.array(
        fc.record({ token: tokenArb, showInFooter: showInFooterArb }),
        { minLength: 0, maxLength: 6 },
      ),
    }),
    { minLength: 0, maxLength: 6 },
  )
  // Ensure section tokens are unique and, within a section, page tokens are
  // unique — so derived ids/paths never collide.
  .map((specs) => {
    const seenSectionTokens = new Set<string>();
    const cleanedSpecs = specs.map((spec, i) => {
      let token = spec.token;
      while (seenSectionTokens.has(token)) token = `${token}x${i}`;
      seenSectionTokens.add(token);

      const seenPageTokens = new Set<string>();
      const pages = spec.pages.map((p, j) => {
        let ptoken = p.token;
        while (seenPageTokens.has(ptoken)) ptoken = `${ptoken}y${j}`;
        seenPageTokens.add(ptoken);
        return { token: ptoken, showInFooter: p.showInFooter };
      });

      return { token, pages };
    });
    return makeIA(cleanedSpecs);
  });

/** Is a page footer-visible? Mirrors the domain default (true when omitted). */
function isFooterVisible(page: PageRef): boolean {
  return page.showInFooter !== false;
}

describe("Property 2: Footer directory mirrors the Information Architecture", () => {
  it("groups correspond one-to-one with sections; footer-visible pages appear exactly once in their owning group; labels use section.label", () => {
    fc.assert(
      fc.property(iaArb, (ia) => {
        const footer = buildFooterDirectory(ia);

        // (7.2/7.7) One group per section, one-to-one and in section order.
        expect(footer.groups.length).toBe(ia.sections.length);

        ia.sections.forEach((section, i) => {
          const group = footer.groups[i];

          // Group corresponds to this section (by id) and preserves order.
          expect(group.sectionId).toBe(section.id);

          // (7.4/7.8) Group label is the human-readable section label, never id.
          expect(group.label).toBe(section.label);
          expect(group.label).not.toBe(section.id);

          // Expected footer-visible pages for this section (owning section).
          const expectedVisible = section.pages.filter(isFooterVisible);

          // (7.2/7.3) No missing, no extra: exactly the footer-visible pages,
          // each appearing exactly once, in section page order.
          expect(group.links.length).toBe(expectedVisible.length);

          const groupPageIds = group.links.map((l) => l.pageId);
          const expectedIds = expectedVisible.map((p) => p.id);
          expect(groupPageIds).toEqual(expectedIds);

          // Each appears exactly once (no duplicates within the group).
          expect(new Set(groupPageIds).size).toBe(groupPageIds.length);

          // Hidden pages (showInFooter === false) never appear.
          const hiddenIds = section.pages
            .filter((p) => !isFooterVisible(p))
            .map((p) => p.id);
          for (const hidden of hiddenIds) {
            expect(groupPageIds).not.toContain(hidden);
          }

          // Each link mirrors its authored page's label and path.
          group.links.forEach((link, j) => {
            const page = expectedVisible[j];
            expect(link.pageId).toBe(page.id);
            expect(link.label).toBe(page.label);
            expect(link.path).toBe(page.path);
          });
        });

        // Global check: every footer-visible page in the IA appears exactly once
        // across the whole footer, in the group of its owning section.
        const allFooterPageIds = footer.groups.flatMap((g) =>
          g.links.map((l) => l.pageId),
        );
        const allExpectedVisibleIds = ia.sections.flatMap((s) =>
          s.pages.filter(isFooterVisible).map((p) => p.id),
        );
        expect(allFooterPageIds.slice().sort()).toEqual(
          allExpectedVisibleIds.slice().sort(),
        );
        // Exactly once across the whole footer (no cross-group duplication).
        expect(new Set(allFooterPageIds).size).toBe(allFooterPageIds.length);
      }),
      { numRuns: MIN_ITERATIONS },
    );
  });
});
