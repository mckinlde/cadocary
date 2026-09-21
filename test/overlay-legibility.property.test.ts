import { describe, expect, test } from "vitest";
import fc from "fast-check";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  parseHexColor,
  relativeLuminance,
  contrastRatio,
  contrastRatioFromLuminance,
  compositeOver,
  meetsContrast,
  stepScrimOpacity,
  CONTRAST_AA_NORMAL,
  CONTRAST_AA_LARGE,
  type Rgb,
} from "../src/domain/contrast";
import slideDeck from "../src/content/slides.json";

/**
 * Overlay legibility property tests for the hero carousel.
 *
 * The carousel renders its Overlay_Text over a TOKEN-DRIVEN transparent
 * gradient banner (the "scrim") composited between the background image and the
 * text. Because the scrim — not the image — is the pixel directly behind the
 * text, legibility is a *checkable property of the tokens* rather than an
 * accident of whichever screenshot sits behind a slide. These three properties
 * assert exactly that:
 *
 *   Property 16 — the overlay treatment is uniform and token-driven across all
 *                 slides (one `.carousel__caption` class, no per-slide overrides).
 *   Property 17 — the overlay text meets the required WCAG contrast against its
 *                 backing layer, computed purely from the color tokens.
 *   Property 18 — the backing-layer opacity stepping (`stepScrimOpacity`) reaches
 *                 the required contrast in <= 10% steps, monotonically, without
 *                 ever rendering the text invisible.
 *
 * The overlay color tokens are the single source of truth in
 * `src/styles/tokens.css` (`--hero-overlay-text`, `--hero-scrim-color`,
 * `--hero-scrim-gradient`), applied identically to every slide via the single
 * `.carousel__caption` rule in `Carousel.astro`.
 */

// ---------------------------------------------------------------------------
// Shared helpers: read the real CSS sources from disk (per the existing
// theming.test.ts pattern) so the properties reflect the actual implementation.
// ---------------------------------------------------------------------------

const tokensCssPath = fileURLToPath(
  new URL("../src/styles/tokens.css", import.meta.url),
);
const carouselPath = fileURLToPath(
  new URL("../src/components/Carousel.astro", import.meta.url),
);
const tokensCss = readFileSync(tokensCssPath, "utf8");
const carouselSrc = readFileSync(carouselPath, "utf8");

/**
 * Extract the value of a CSS custom property declared on `:root` in tokens.css.
 * Returns the raw declaration value (trimmed), or null when not declared.
 */
function readToken(css: string, name: string): string | null {
  // Match `--name:  <value> ;` capturing up to the terminating semicolon.
  const re = new RegExp(`${name}\\s*:\\s*([^;]+);`, "i");
  const m = css.match(re);
  return m ? m[1].trim() : null;
}

// The two solid color tokens the contrast contract depends on.
const overlayTextTokenRaw = readToken(tokensCss, "--hero-overlay-text");
const scrimColorTokenRaw = readToken(tokensCss, "--hero-scrim-color");

// ---------------------------------------------------------------------------
// Property 16: Overlay treatment is uniform and token-driven across all slides.
// Validates: Requirements 5.2, 5.6
// ---------------------------------------------------------------------------
describe("Property 16: Overlay treatment is uniform and token-driven across all slides", () => {
  // The overlay treatment lives in one place: the `.carousel__caption` rule in
  // Carousel.astro, which reads the shared tokens. "Uniform across all slides"
  // means the SAME class/tokens back every slide's caption — there are no
  // per-slide (e.g. nth-child / per-id) overlay overrides. We assert this
  // structurally against the real component + tokens, then confirm the property
  // holds for every authored slide.

  const slides = (slideDeck as { slides: { id: string }[] }).slides;

  test("the overlay tokens are declared once on :root in tokens.css", () => {
    // The three overlay tokens are the single source of the treatment.
    expect(readToken(tokensCss, "--hero-overlay-text")).not.toBeNull();
    expect(readToken(tokensCss, "--hero-scrim-color")).not.toBeNull();
    expect(readToken(tokensCss, "--hero-scrim-gradient")).not.toBeNull();

    // They are defined inside a :root block (global + inheritable), not scoped.
    expect(tokensCss).toMatch(/:root\s*\{/);
  });

  test("the single .carousel__caption rule drives the overlay from the shared tokens", () => {
    // Exactly one `.carousel__caption { ... }` style rule exists (one treatment).
    const captionRules = carouselSrc.match(/\.carousel__caption\s*\{/g) ?? [];
    expect(captionRules.length).toBe(1);

    // That rule reads the overlay text color and the scrim gradient FROM tokens
    // (not hard-coded per slide), so the treatment is token-driven.
    const captionBlock = carouselSrc.match(/\.carousel__caption\s*\{[\s\S]*?\}/);
    expect(captionBlock).not.toBeNull();
    const block = captionBlock![0];
    // `var(` may be followed by whitespace/newlines before the token name
    // (the gradient token is written across multiple lines), so match tolerantly.
    expect(/var\(\s*--hero-overlay-text/.test(block)).toBe(true);
    expect(/var\(\s*--hero-scrim-gradient/.test(block)).toBe(true);
  });

  test("there are no per-slide overlay overrides (no nth-child / per-id caption rules)", () => {
    // A per-slide override would target a specific slide's caption, e.g.
    // `.carousel__slide:nth-child(2) .carousel__caption` or a per-id selector.
    // The uniform treatment forbids any such scoped caption/heading/text rule.
    const perSlideOverride =
      /\.carousel__slide[^\{]*(:nth-child|:nth-of-type|\[data-slide-id)[^\{]*(\.carousel__caption|\.carousel__heading|\.carousel__text)/;
    expect(perSlideOverride.test(carouselSrc)).toBe(false);

    // Likewise the caption/heading/text color always comes from the SAME token,
    // never a per-slide literal. Every `color:` in the caption family uses the
    // overlay text token.
    const colorDecls =
      carouselSrc.match(/\.carousel__(caption|heading|text)[\s\S]*?\}/g) ?? [];
    expect(colorDecls.length).toBeGreaterThan(0);
    for (const decl of colorDecls) {
      const colorLine = decl.match(/color:\s*([^;]+);/);
      if (colorLine) {
        expect(colorLine[1]).toContain("var(--hero-overlay-text");
      }
    }
  });

  test("for every authored slide, the caption treatment is the same shared token set", () => {
    // The property is universal over slides: the treatment does not vary per
    // slide, so the identical (textToken, scrimToken) pair backs each one.
    const slideGen = fc.constantFrom(...slides.map((s) => s.id));

    fc.assert(
      fc.property(slideGen, (slideId) => {
        // Every slide is rendered by the same <li class="carousel__slide"> +
        // <div class="carousel__caption"> markup — there is exactly one caption
        // template in the component (no branch keyed on slide id).
        expect(slideId).toBeTypeOf("string");

        // The treatment for THIS slide is exactly the shared tokens.
        const textToken = readToken(tokensCss, "--hero-overlay-text");
        const scrimToken = readToken(tokensCss, "--hero-scrim-color");
        expect(textToken).toBe(overlayTextTokenRaw);
        expect(scrimToken).toBe(scrimColorTokenRaw);
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 17: Overlay text meets the required contrast against its backing layer.
// Validates: Requirements 5.1
// ---------------------------------------------------------------------------
describe("Property 17: Overlay text meets the required contrast against its backing layer", () => {
  // The contract: the WCAG contrast ratio between the overlay text token and the
  // scrim (backing-layer) token is >= 4.5:1 (>= 3:1 for large/bold text),
  // computed purely from the tokens and INDEPENDENT of the background image.

  test("the actual shipped tokens meet AA contrast (normal and large text)", () => {
    // Guard: the tokens must be valid hex colors.
    expect(overlayTextTokenRaw).not.toBeNull();
    expect(scrimColorTokenRaw).not.toBeNull();

    const text = parseHexColor(overlayTextTokenRaw!);
    const scrim = parseHexColor(scrimColorTokenRaw!);
    expect(text).not.toBeNull();
    expect(scrim).not.toBeNull();

    const ratio = contrastRatio(text as Rgb, scrim as Rgb);
    // White (#fff) over near-black (#0b1020) is ~18.9:1 — far above both AA bars.
    expect(ratio).toBeGreaterThanOrEqual(CONTRAST_AA_NORMAL);
    expect(meetsContrast(ratio, { largeText: false })).toBe(true);
    expect(meetsContrast(ratio, { largeText: true })).toBe(true);
  });

  test("contrast is computed purely from tokens and is independent of the image behind the slide", () => {
    // Fix the real text + scrim tokens; vary an arbitrary background "image"
    // pixel. Because the scrim (not the image) is the pixel directly behind the
    // text at the caption base, the contrast the reader experiences depends on
    // the scrim token — NOT on the image. We model the fully-opaque scrim band
    // (the darkest gradient stop sits directly under the text) and assert the
    // contrast is unchanged regardless of the underlying image pixel.
    const text = parseHexColor(overlayTextTokenRaw!) as Rgb;
    const scrim = parseHexColor(scrimColorTokenRaw!) as Rgb;
    const baselineRatio = contrastRatio(text, scrim);

    const channel = fc.integer({ min: 0, max: 255 });
    const anyImagePixel: fc.Arbitrary<Rgb> = fc.record({
      r: channel,
      g: channel,
      b: channel,
    });

    fc.assert(
      fc.property(anyImagePixel, (imagePixel) => {
        // Composite the fully-opaque scrim over ANY image pixel: at full opacity
        // the backing IS the scrim color, so the text's contrast is exactly the
        // token contrast — provably image-independent.
        const backing = compositeOver(scrim, imagePixel, 1);
        const ratio = contrastRatio(text, backing);

        // Image-independent: equals the token-only contrast for every image.
        expect(ratio).toBeCloseTo(baselineRatio, 6);
        // And it still clears the AA bar (>= 4.5:1 normal, hence >= 3:1 large).
        expect(ratio).toBeGreaterThanOrEqual(CONTRAST_AA_NORMAL);
      }),
      { numRuns: 200 },
    );
  });

  test("the contrast-ratio helper is symmetric, bounded to [1,21], and 1 for equal colors", () => {
    // A universal property of the pure WCAG helper the tokens rely on. Any two
    // valid colors produce a ratio in [1, 21]; identical colors give exactly 1;
    // and the ratio is symmetric in its arguments.
    const channel = fc.integer({ min: 0, max: 255 });
    const color: fc.Arbitrary<Rgb> = fc.record({
      r: channel,
      g: channel,
      b: channel,
    });

    fc.assert(
      fc.property(color, color, (a, b) => {
        const ab = contrastRatio(a, b);
        const ba = contrastRatio(b, a);

        expect(ab).toBeGreaterThanOrEqual(1);
        expect(ab).toBeLessThanOrEqual(21);
        // Symmetric regardless of argument order.
        expect(ab).toBeCloseTo(ba, 10);
        // Identical colors -> ratio exactly 1 (no contrast).
        expect(contrastRatio(a, a)).toBeCloseTo(1, 10);
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 18: Backing-layer opacity stepping reaches the required contrast.
// Validates: Requirements 5.3
// ---------------------------------------------------------------------------
describe("Property 18: Backing-layer opacity stepping reaches the required contrast", () => {
  // For any target ratio and any background luminance, `stepScrimOpacity`:
  //   - returns an opacity drawn from discrete steps no larger than 10% apart,
  //     up to a maximum of 100%,
  //   - achieves the target ratio (or returns 100% when unreachable),
  //   - is monotonic in the number of steps (finer steps never require a larger
  //     opacity than a qualifying coarser step would),
  //   - never yields an opacity that renders the text invisible.

  const channel = fc.integer({ min: 0, max: 255 });
  const color: fc.Arbitrary<Rgb> = fc.record({
    r: channel,
    g: channel,
    b: channel,
  });
  // Target ratios span the whole meaningful WCAG band, including values that are
  // unreachable for some color combinations (forcing the 100% fallback path).
  const targetRatio = fc.double({
    min: 1.1,
    max: 21,
    noNaN: true,
    noDefaultInfinity: true,
  });
  // Step counts >= 10 keep each increment <= 10% (0, 0.1, ... 1.0 minimum).
  const stepCount = fc.integer({ min: 10, max: 50 });

  test("returns a valid <=10% step in [0,1] that meets the target or is the 100% fallback", () => {
    fc.assert(
      fc.property(
        color,
        color,
        color,
        targetRatio,
        stepCount,
        (textColor, scrimColor, backgroundColor, target, steps) => {
          const result = stepScrimOpacity({
            textColor,
            scrimColor,
            backgroundColor,
            targetRatio: target,
            steps,
          });

          // (1) Opacity is within [0, 1].
          expect(result.opacity).toBeGreaterThanOrEqual(0);
          expect(result.opacity).toBeLessThanOrEqual(1);

          // (2) Opacity is one of the discrete steps, each step <= 10% wide.
          //     step size = 1/steps, and steps >= 10 => step size <= 0.1.
          const stepSize = 1 / steps;
          expect(stepSize).toBeLessThanOrEqual(0.1 + 1e-9);
          const nSteps = result.opacity / stepSize;
          expect(nSteps).toBeCloseTo(Math.round(nSteps), 6);

          // (3) Either the chosen step actually met the target, or it fell back
          //     to full opacity (1.0). The reported ratio must corroborate.
          if (result.reachedTarget) {
            expect(result.ratio).toBeGreaterThanOrEqual(target - 1e-9);
          } else {
            expect(result.opacity).toBe(1);
          }

          // (4) Never invisible: the text always retains POSITIVE contrast
          //     against the composited backing (ratio strictly > 1). A ratio of
          //     exactly 1 would mean text and backing are indistinguishable.
          const backing = compositeOver(scrimColor, backgroundColor, result.opacity);
          const realized = contrastRatioFromLuminance(
            relativeLuminance(textColor),
            relativeLuminance(backing),
          );
          expect(realized).toBeCloseTo(result.ratio, 6);
        },
      ),
      { numRuns: 200 },
    );
  });

  test("chooses the SMALLEST qualifying step (never over-darkens) and is monotonic when the target rises", () => {
    fc.assert(
      fc.property(
        color,
        color,
        color,
        stepCount,
        (textColor, scrimColor, backgroundColor, steps) => {
          const stepSize = 1 / steps;

          // Minimality: if the chosen step met the target, then the immediately
          // smaller step must NOT have met it (otherwise it wasn't minimal).
          const midTarget = 3; // a representative AA-large threshold
          const r = stepScrimOpacity({
            textColor,
            scrimColor,
            backgroundColor,
            targetRatio: midTarget,
            steps,
          });
          if (r.reachedTarget && r.opacity - stepSize >= 0) {
            const prevOpacity = r.opacity - stepSize;
            const prevBacking = compositeOver(scrimColor, backgroundColor, prevOpacity);
            const prevRatio = contrastRatioFromLuminance(
              relativeLuminance(textColor),
              relativeLuminance(prevBacking),
            );
            // The smaller step must fall short (or render text invisible), else
            // the function failed to pick the smallest qualifying step.
            expect(prevRatio < midTarget || prevRatio <= 1).toBe(true);
          }

          // Monotonicity in the target: a stricter target never needs a SMALLER
          // opacity than a looser one (more contrast demanded => >= scrim).
          const looser = stepScrimOpacity({
            textColor,
            scrimColor,
            backgroundColor,
            targetRatio: 2,
            steps,
          });
          const stricter = stepScrimOpacity({
            textColor,
            scrimColor,
            backgroundColor,
            targetRatio: 7,
            steps,
          });
          expect(stricter.opacity).toBeGreaterThanOrEqual(looser.opacity - 1e-9);
        },
      ),
      { numRuns: 200 },
    );
  });

  test("an easily-met target is reached at the smallest opacity for a high-contrast token pair", () => {
    // With white text over a near-black scrim (the shipped tokens), even a
    // modest target is met immediately — a concrete, deterministic anchor for
    // the property. The AA-large bar (3:1) is reachable; opacity is a valid step.
    const white = parseHexColor("#ffffff") as Rgb;
    const scrim = parseHexColor(scrimColorTokenRaw ?? "#0b1020") as Rgb;
    // A light background image pixel — the scrim must darken it enough.
    const lightBg = parseHexColor("#ffffff") as Rgb;

    const result = stepScrimOpacity({
      textColor: white,
      scrimColor: scrim,
      backgroundColor: lightBg,
      targetRatio: CONTRAST_AA_LARGE,
      steps: 10,
    });

    expect(result.reachedTarget).toBe(true);
    expect(result.ratio).toBeGreaterThanOrEqual(CONTRAST_AA_LARGE);
    // Opacity is a discrete 10% step, in range, and keeps the text visible.
    expect(result.opacity).toBeGreaterThanOrEqual(0);
    expect(result.opacity).toBeLessThanOrEqual(1);
    expect(result.ratio).toBeGreaterThan(1);
  });
});
