/**
 * Carousel pure core — state transitions and slide sequencing.
 *
 * These functions are intentionally pure (no DOM, no timers, no randomness) so
 * that the carousel's core behavior can be property-tested in isolation from the
 * hydrated island that renders it. The island (task 12.1) owns timing and DOM;
 * it delegates every state change to the functions here.
 *
 * Design references (design.md → Components and Interfaces → Hero Section):
 *   CarouselState = { current: number; playing: boolean }
 *   advance(state, length): CarouselState   // wraps last -> first
 *   goTo(state, index, length): CarouselState
 *   buildSlideSequence(slides, failedIds): Slide[]  // excludes failed, preserves order
 */

import type { CarouselState, Slide } from "../types";

/**
 * Advance the current slide index by one, wrapping from the last slide back to
 * the first.
 *
 * Requirements: 3.2 (exactly one in-range slide), 3.5 (wrap last -> first),
 * 9.5 / 9.6 (single-slide display maintained on next/previous).
 *
 * @param state  current carousel state
 * @param length number of available (in-range) slides; must be a positive integer
 * @returns a new state whose `current` is the next index (mod `length`)
 */
export function advance(state: CarouselState, length: number): CarouselState {
  // With no slides there is no valid index to move to; keep state unchanged
  // rather than producing a NaN/negative index.
  if (length <= 0) {
    return state;
  }
  // Normalize the incoming index into range first so the result is always a
  // single, in-range slide even if the caller passed a stale/out-of-range value.
  const currentInRange = normalizeIndex(state.current, length);
  return { ...state, current: (currentInRange + 1) % length };
}

/**
 * Set the current slide index to an explicit in-range target.
 *
 * Requirements: 3.6 (direct slide-target control displays the targeted slide),
 * 9.5 / 9.6 (single-slide display maintained).
 *
 * Out-of-range targets are ignored (state is returned unchanged) so the carousel
 * can never end up displaying a non-existent slide.
 *
 * @param state  current carousel state
 * @param index  target slide index
 * @param length number of available (in-range) slides
 * @returns a new state at `index`, or the original state if `index` is out of range
 */
export function goTo(
  state: CarouselState,
  index: number,
  length: number,
): CarouselState {
  if (!Number.isInteger(index) || index < 0 || index >= length) {
    return state;
  }
  return { ...state, current: index };
}

/**
 * Build the sequence of slides to display, excluding any slides whose ids are in
 * the failed set while preserving the original relative order of the remainder.
 *
 * Requirement: 3.11 (slides that fail to load are excluded from the displayed
 * sequence; the remaining slides continue to display in order).
 *
 * @param slides    the authored slide list, in order
 * @param failedIds ids of slides that failed to load
 * @returns exactly the non-failed slides, in their original relative order
 */
export function buildSlideSequence(
  slides: Slide[],
  failedIds: Set<string>,
): Slide[] {
  return slides.filter((slide) => !failedIds.has(slide.id));
}

/**
 * Normalize an arbitrary integer index into `[0, length)` using a wrap that also
 * handles negative inputs (JavaScript's `%` can be negative). Internal helper.
 */
function normalizeIndex(index: number, length: number): number {
  const wrapped = index % length;
  return wrapped < 0 ? wrapped + length : wrapped;
}
