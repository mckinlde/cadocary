import { describe, expect, test } from "vitest";
import fc from "fast-check";

import { buildSlideSequence } from "../src/domain/carousel";
import type { Slide } from "../src/types";

/**
 * Feature: website-redesign, Property 8: Failed slides are excluded while order is preserved
 *
 * Validates: Requirements 3.11
 *
 * For any slide list and any subset of failed slide ids, buildSlideSequence
 * returns exactly the slides whose ids are NOT in the failed set, in their
 * original relative order, containing none of the failed slides.
 */
describe("Property 8: Failed slides are excluded while order is preserved", () => {
  // A slide generator. Only `id` matters for sequencing; the rest is filler that
  // satisfies the Slide shape. Ids are kept unique per deck (see below) so the
  // property reasons about a clean id-set semantics without duplicate ambiguity.
  const slideFrom = (id: string): Slide => ({
    id,
    image: { src: `/img/${id}.png`, alt: `alt ${id}` },
    heading: `Heading ${id}`,
  });

  // Generate a slide list with UNIQUE ids (a set of ids -> ordered slide list).
  // uniqueArray gives us distinct ids; we then map to slides preserving order.
  const slidesGen = fc
    .uniqueArray(fc.string({ minLength: 1, maxLength: 6 }), {
      minLength: 0,
      maxLength: 30,
    })
    .map((ids) => ids.map(slideFrom));

  // From a slide list, build a failed-id subset: some ids drawn from the deck's
  // existing ids, plus some ids that are (almost certainly) not present. This
  // exercises both "excluded" ids and irrelevant/unknown ids in the failed set.
  const scenarioGen = slidesGen.chain((slides) => {
    const existingIds = slides.map((s) => s.id);
    const drawnFailed =
      existingIds.length === 0
        ? fc.constant<string[]>([])
        : fc.subarray(existingIds);
    // Ids that don't exist in the deck (prefixed so they can't collide with the
    // generated deck ids of maxLength 6).
    const absentFailed = fc.array(
      fc.string({ minLength: 1, maxLength: 6 }).map((s) => `__absent__${s}`),
      { maxLength: 8 },
    );
    return fc.record({
      slides: fc.constant(slides),
      failedIds: drawnFailed.chain((drawn) =>
        absentFailed.map((absent) => new Set<string>([...drawn, ...absent])),
      ),
    });
  });

  test("result excludes all failed ids, keeps exactly the non-failed slides, preserving order", () => {
    fc.assert(
      fc.property(scenarioGen, ({ slides, failedIds }) => {
        const result = buildSlideSequence(slides, failedIds);

        // 1) Result contains no failed ids.
        for (const slide of result) {
          expect(failedIds.has(slide.id)).toBe(false);
        }

        // 2) Result is EXACTLY the non-failed slides (same objects, same order).
        const expected = slides.filter((s) => !failedIds.has(s.id));
        expect(result).toEqual(expected);

        // 3) Relative order preserved: result is a subsequence of the input.
        //    Walk the input once; every result element must appear in order.
        let cursor = 0;
        for (const slide of result) {
          const found = slides.indexOf(slide, cursor);
          expect(found).toBeGreaterThanOrEqual(cursor);
          cursor = found + 1;
        }

        // 4) Nothing is dropped that should have stayed: every input slide whose
        //    id is not failed appears in the result.
        const resultIds = new Set(result.map((s) => s.id));
        for (const slide of slides) {
          if (!failedIds.has(slide.id)) {
            expect(resultIds.has(slide.id)).toBe(true);
          }
        }
      }),
      { numRuns: 200 },
    );
  });
});
