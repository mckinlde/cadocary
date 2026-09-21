import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { advance, goTo, buildSlideSequence } from "../src/domain/carousel";
import type { CarouselState, Slide } from "../src/types";
import slidesDeck from "../src/content/slides.json";
import mission from "../src/content/mission.json";

/**
 * Task 12.3 — Interaction / timing tests for the hero (example-based, fake timers).
 *
 * These are EXAMPLE / INTERACTION / TIMING tests (NOT property-based). They cover
 * the design's "Carousel timing (with fake timers)" and "Hero layout" example
 * tests. Because the carousel's interactive behavior lives inside a custom
 * element embedded in an .astro <script> (which cannot be cleanly imported into
 * a Node/vitest test), we follow the design's model-level approach:
 *
 *   The island owns DOM + timing ONLY and delegates every state transition to
 *   the pure functions in src/domain/carousel.ts (advance/goTo/buildSlideSequence).
 *   So we model the island's *timer contract* with vitest fake timers driving the
 *   same pure functions the island uses. This exercises the auto-advance loop,
 *   pause, and resume-within-8s behavior deterministically and without DOM
 *   fragility. Real-DOM/pixel-layout criteria are noted as deferred to e2e below.
 *
 * Coverage map (requirements 3.1, 3.4, 3.7, 3.8, 3.9, 3.10, 4.1, 4.2, 4.3, 4.4):
 *   - 3.4  auto-advance at the configured 5–8s interval  → MODELED (fake timers)
 *   - 3.5  wrap last → first (exercised by the loop)      → MODELED
 *   - 3.7  pause on interaction/focus                     → MODELED (stop ticking)
 *   - 3.8  resume within 8s after interaction ends        → MODELED (timer bound)
 *   - 3.9  CTA slides carry a navigable path              → asserted on seed data
 *   - 3.10 prev/next + direct targets conceptually present→ asserted (>=2 slides,
 *          prev/next reachable via advance/goTo over the deck)
 *   - 3.4 bound: intervalSeconds within 5..8              → asserted on seed data
 *   - 4.x hero layout / mission                           → seed-level assertions
 *          (mission present + non-empty for 4.2/4.3, placeholder path for 4.4)
 *
 * DEFERRED to real-DOM / e2e (documented, not asserted here):
 *   - 3.1  hero rendered at the top of the home page (DOM position / order)
 *   - 4.1  ≤48px CSS gap between carousel bottom and mission top (computed style)
 *   - 4.2  mission visible without interaction (rendered visibility)
 *   - 4.3  mission unchanged in position/content as slides advance (live DOM)
 *   - 4.4  reserved layout space preserved (computed min-height)
 *   These depend on rendered CSS / DOM geometry and the hydrated custom element,
 *   which are validated with a browser-based e2e/component runner rather than the
 *   Node model here. We assert their *content preconditions* at the model level.
 */

// The seed deck is authored as { intervalSeconds, slides }.
const deck = slidesDeck as { intervalSeconds: number; slides: Slide[] };
const SEED_SLIDES: Slide[] = deck.slides;
const INTERVAL_SECONDS = deck.intervalSeconds;
const INTERVAL_MS = INTERVAL_SECONDS * 1000;

/**
 * A tiny faithful model of the island's timer contract. It mirrors the island's
 * startTimer/stopTimer/pause/scheduleResume behavior (see Carousel.astro) but
 * uses the SAME pure `advance` function for the actual state transition. This is
 * exactly what runs on the client; only the DOM painting is omitted.
 */
class CarouselTimerModel {
  state: CarouselState = { current: 0, playing: true };
  private readonly length: number;
  private readonly intervalMs: number;
  /** Resume delay after interaction ends; must stay within the 8s bound (3.8). */
  private readonly resumeDelayMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private resumeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(length: number, intervalMs: number, resumeDelayMs = 1000) {
    this.length = length;
    this.intervalMs = intervalMs;
    this.resumeDelayMs = resumeDelayMs;
  }

  private tick = () => {
    if (this.state.playing) {
      this.state = advance(this.state, this.length);
    }
  };

  start() {
    // Mirror the island: don't auto-advance a single-slide deck (3.4 idle only).
    if (this.length <= 1) return;
    this.stop();
    this.timer = setInterval(this.tick, this.intervalMs);
  }

  private stop() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Interaction/focus begins → pause auto-advance (3.7). */
  pause() {
    this.state = { ...this.state, playing: false };
    this.stop();
    if (this.resumeTimer !== null) {
      clearTimeout(this.resumeTimer);
      this.resumeTimer = null;
    }
  }

  /** Interaction ends → schedule resume within the 8s bound (3.8). */
  scheduleResume() {
    if (this.resumeTimer !== null) clearTimeout(this.resumeTimer);
    this.resumeTimer = setTimeout(() => {
      this.state = { ...this.state, playing: true };
      this.start();
      this.resumeTimer = null;
    }, this.resumeDelayMs);
  }
}

describe("Hero carousel timing/interaction (fake timers, model-level)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // --- 3.4: auto-advance at the configured interval, and 3.5 wrap ---
  test("auto-advances one slide per configured interval and wraps last → first (3.4, 3.5)", () => {
    const length = SEED_SLIDES.length;
    const model = new CarouselTimerModel(length, INTERVAL_MS);
    model.start();

    expect(model.state.current).toBe(0);

    // Just before the interval elapses, no advance has happened yet.
    vi.advanceTimersByTime(INTERVAL_MS - 1);
    expect(model.state.current).toBe(0);

    // At exactly one interval, we advance exactly one slide.
    vi.advanceTimersByTime(1);
    expect(model.state.current).toBe(1);

    // Advancing through a full cycle wraps back to the first slide (3.5).
    vi.advanceTimersByTime(INTERVAL_MS * (length - 1));
    expect(model.state.current).toBe(0);

    // The index stays in range across many ticks (single in-range slide).
    vi.advanceTimersByTime(INTERVAL_MS * 25);
    expect(model.state.current).toBeGreaterThanOrEqual(0);
    expect(model.state.current).toBeLessThan(length);
  });

  // --- 3.7: pause on interaction/focus stops auto-advancement ---
  test("pauses auto-advancement while interacting/focused (3.7)", () => {
    const length = SEED_SLIDES.length;
    const model = new CarouselTimerModel(length, INTERVAL_MS);
    model.start();

    // Advance once, then a visitor starts interacting (or focuses a slide).
    vi.advanceTimersByTime(INTERVAL_MS);
    expect(model.state.current).toBe(1);

    model.pause();
    expect(model.state.playing).toBe(false);

    // While paused, time passing must NOT advance the slide (3.7).
    vi.advanceTimersByTime(INTERVAL_MS * 5);
    expect(model.state.current).toBe(1);
  });

  // --- 3.8: resume within 8s after interaction ends ---
  test("resumes auto-advancement within 8s after interaction ends (3.8)", () => {
    const length = SEED_SLIDES.length;
    const model = new CarouselTimerModel(length, INTERVAL_MS);
    model.start();

    model.pause();
    const pausedAt = model.state.current;
    model.scheduleResume();

    // Still paused right up to the resume delay boundary.
    vi.advanceTimersByTime(999);
    expect(model.state.playing).toBe(false);

    // Resume occurs within the 8s bound (well under it): 1s after interaction end.
    // Advance to exactly the resume point (total 1000ms), which is <= 8000ms (3.8).
    vi.advanceTimersByTime(1);
    expect(model.state.playing).toBe(true);
    // No auto-advance has happened yet since a full interval has not elapsed.
    expect(model.state.current).toBe(pausedAt);

    // After resuming, ticking advances slides again (auto-advance really restarts).
    vi.advanceTimersByTime(INTERVAL_MS);
    expect(model.state.current).toBe((pausedAt + 1) % length);
  });

  // --- 3.7 + 3.8 combined: manual navigation counts as interaction then resumes ---
  test("manual navigation pauses then reschedules resume within 8s (3.7, 3.8)", () => {
    const length = SEED_SLIDES.length;
    const model = new CarouselTimerModel(length, INTERVAL_MS);
    model.start();

    // A user clicks next: island pauses, moves, then schedules resume.
    model.pause();
    model.state = advance(model.state, length); // the manual move
    model.scheduleResume();
    expect(model.state.current).toBe(1);
    expect(model.state.playing).toBe(false);

    // No drift while paused, then resume within 8s.
    vi.advanceTimersByTime(500);
    expect(model.state.playing).toBe(false);
    vi.advanceTimersByTime(8000);
    expect(model.state.playing).toBe(true);
  });

  // --- single-slide deck stops auto-advancing (design.md error handling for 3.11/3.4) ---
  test("does not auto-advance when only one slide remains", () => {
    const single = buildSlideSequence(
      SEED_SLIDES,
      new Set(SEED_SLIDES.slice(1).map((s) => s.id)),
    );
    expect(single).toHaveLength(1);

    const model = new CarouselTimerModel(single.length, INTERVAL_MS);
    model.start();
    vi.advanceTimersByTime(INTERVAL_MS * 10);
    expect(model.state.current).toBe(0);
  });
});

describe("Hero carousel controls & content preconditions (seed-level)", () => {
  // --- 3.4 bound: interval within 5..8 seconds inclusive ---
  test("configured interval is within the 5–8s bound (3.4)", () => {
    expect(Number.isFinite(INTERVAL_SECONDS)).toBe(true);
    expect(INTERVAL_SECONDS).toBeGreaterThanOrEqual(5);
    expect(INTERVAL_SECONDS).toBeLessThanOrEqual(8);
  });

  // --- 3.10: prev/next present + at least 2 slides so both directions are usable ---
  test("deck has >=2 slides so prev/next and direct targets are meaningful (3.10)", () => {
    expect(SEED_SLIDES.length).toBeGreaterThanOrEqual(2);

    const length = SEED_SLIDES.length;
    const start: CarouselState = { current: 1, playing: true };

    // "Next" reaches the following slide.
    expect(advance(start, length).current).toBe(2 % length);

    // "Previous" (the island computes the wrapped index-1 and delegates to goTo)
    // reaches the preceding slide.
    const prevTarget = (start.current - 1 + length) % length;
    expect(goTo(start, prevTarget, length).current).toBe(0);

    // Direct slide-target control lands on any chosen in-range slide.
    for (let i = 0; i < length; i++) {
      expect(goTo(start, i, length).current).toBe(i);
    }
  });

  // --- 3.9: CTA slides carry a navigable path (and pageId) ---
  test("every CTA slide carries a navigable path and pageId (3.9)", () => {
    const ctaSlides = SEED_SLIDES.filter((s) => s.cta);
    // The seed deck includes CTAs; if present each must be navigable.
    expect(ctaSlides.length).toBeGreaterThan(0);
    for (const slide of ctaSlides) {
      expect(typeof slide.cta!.path).toBe("string");
      expect(slide.cta!.path.startsWith("/")).toBe(true);
      expect(slide.cta!.label.length).toBeGreaterThan(0);
      expect(slide.cta!.pageId.length).toBeGreaterThan(0);
    }
  });
});

describe("Hero mission content preconditions (seed-level; layout deferred to e2e)", () => {
  const missionDoc = mission as { heading: string; body: unknown[] };

  // --- 4.2 / 4.3 precondition: mission copy is present and non-empty ---
  // Real rendered-visibility (4.2) and unchanged-as-slides-advance (4.3) are
  // validated in e2e; here we assert the content that HeroSection renders exists.
  test("mission copy is present and non-empty (supports 4.2, 4.3)", () => {
    expect(missionDoc).toBeTruthy();
    expect(typeof missionDoc.heading).toBe("string");
    expect(missionDoc.heading.length).toBeGreaterThan(0);
    expect(Array.isArray(missionDoc.body)).toBe(true);
    expect(missionDoc.body.length).toBeGreaterThan(0);
  });

  // --- 4.4 precondition: HeroSection's "unavailable" branch is well-defined ---
  // The ≤48px gap (4.1) and reserved-space min-height (4.4) are CSS/geometry
  // concerns validated in e2e. Here we assert the availability rule HeroSection
  // uses to choose real copy vs placeholder: mission is "available" iff it has a
  // non-empty body array.
  test("mission availability rule: empty/absent body → unavailable (supports 4.4)", () => {
    const isAvailable = (m: { body?: unknown[] } | null | undefined) =>
      !!m && Array.isArray(m.body) && m.body.length > 0;

    expect(isAvailable(missionDoc)).toBe(true);
    expect(isAvailable(null)).toBe(false);
    expect(isAvailable(undefined)).toBe(false);
    expect(isAvailable({ body: [] })).toBe(false);
  });
});
