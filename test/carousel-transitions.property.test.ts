import { describe, expect, test } from "vitest";
import fc from "fast-check";

import { advance, goTo } from "../src/domain/carousel";
import type { CarouselState } from "../src/types";

/**
 * Feature: website-redesign, Property 7: Carousel transitions are correct (wrap and target)
 *
 * Validates: Requirements 3.5, 3.6
 *
 * For any deck of length n >= 1 and any starting index i in [0, n):
 *  - advancing at the last slide returns to the first, and advancing n times
 *    from i returns to i (3.5 wrap last -> first);
 *  - goTo(state, target, n) for any in-range target sets current to that target
 *    (3.6 direct slide-target control).
 */
describe("Property 7: Carousel transitions are correct (wrap and target)", () => {
  // Generator: a deck length n >= 1 paired with a valid starting index i in [0, n).
  const deckAndIndex = fc
    .integer({ min: 1, max: 50 })
    .chain((n) =>
      fc.record({
        length: fc.constant(n),
        start: fc.integer({ min: 0, max: n - 1 }),
      }),
    );

  test("advance wraps last -> first and n advances from i returns to i", () => {
    fc.assert(
      fc.property(deckAndIndex, fc.boolean(), ({ length, start }, playing) => {
        const state: CarouselState = { current: start, playing };

        // Advancing at the last slide returns to the first (wrap).
        const atLast: CarouselState = { current: length - 1, playing };
        expect(advance(atLast, length).current).toBe(0);

        // Advancing n times from i returns to i (a full cycle is the identity on index).
        let cursor = state;
        for (let step = 0; step < length; step++) {
          cursor = advance(cursor, length);
        }
        expect(cursor.current).toBe(start);

        // Each single advance yields exactly (i + 1) mod n, always in range.
        const next = advance(state, length);
        expect(next.current).toBe((start + 1) % length);
        expect(next.current).toBeGreaterThanOrEqual(0);
        expect(next.current).toBeLessThan(length);
        // Advancing must not disturb the play/pause flag.
        expect(next.playing).toBe(playing);
      }),
      { numRuns: 200 },
    );
  });

  test("goTo sets current to any in-range target", () => {
    fc.assert(
      fc.property(deckAndIndex, fc.boolean(), ({ length, start }, playing) => {
        const state: CarouselState = { current: start, playing };

        // For every in-range target, goTo lands exactly on that target.
        for (let target = 0; target < length; target++) {
          const result = goTo(state, target, length);
          expect(result.current).toBe(target);
          expect(result.playing).toBe(playing);
        }
      }),
      { numRuns: 200 },
    );
  });
});
