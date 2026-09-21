import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { advance, goTo } from "../src/domain/carousel";
import type { CarouselState } from "../src/types";

/**
 * Property 6: Carousel always displays exactly one in-range slide.
 *
 * We drive the pure carousel core (advance / goTo) with random action sequences.
 * Starting from a valid state and a deck length >= 1, applying any sequence of
 * actions must always leave `current` as a single integer index within
 * [0, length). This exercises the single-slide invariant that the hydrated
 * carousel island relies on (design.md → Correctness Properties → Property 6).
 */

// A carousel action is either "advance" (next, wraps) or a "goTo" targeting an
// arbitrary integer index (in-range targets move; out-of-range are ignored).
type CarouselAction =
  | { kind: "advance" }
  | { kind: "goTo"; index: number };

function applyAction(
  state: CarouselState,
  action: CarouselAction,
  length: number,
): CarouselState {
  switch (action.kind) {
    case "advance":
      return advance(state, length);
    case "goTo":
      return goTo(state, action.index, length);
  }
}

/**
 * A single scenario: a deck length, a valid starting state, and a random
 * sequence of carousel actions. The starting index and the `goTo` targets are
 * generated *dependent on* the chosen length so that:
 *   - the starting state is always valid ([0, length)), and
 *   - `goTo` targets deliberately span beyond the deck (including negatives) to
 *     probe both valid targets and out-of-range targets that must be ignored.
 */
const scenarioArb = fc.integer({ min: 1, max: 20 }).chain((length) => {
  const advanceArb: fc.Arbitrary<CarouselAction> = fc.constant({
    kind: "advance",
  });
  const goToArb: fc.Arbitrary<CarouselAction> = fc
    .integer({ min: -length - 2, max: length * 2 + 2 })
    .map((index) => ({ kind: "goTo" as const, index }));

  return fc.record({
    length: fc.constant(length),
    start: fc.record({
      current: fc.integer({ min: 0, max: length - 1 }),
      playing: fc.boolean(),
    }),
    actions: fc.array(fc.oneof(advanceArb, goToArb), { maxLength: 50 }),
  });
});

describe("Property 6: carousel single-slide invariant", () => {
  it("keeps `current` a single in-range integer index after any action sequence", () => {
    // Feature: website-redesign, Property 6: Carousel always displays exactly one in-range slide
    fc.assert(
      fc.property(scenarioArb, ({ length, start, actions }) => {
        const finalState = actions.reduce(
          (state, action) => applyAction(state, action, length),
          start as CarouselState,
        );

        // Exactly one current index, which is a single integer within [0, length).
        expect(Number.isInteger(finalState.current)).toBe(true);
        expect(finalState.current).toBeGreaterThanOrEqual(0);
        expect(finalState.current).toBeLessThan(length);
      }),
      { numRuns: 100 },
    );
  });
});
