/**
 * WCAG contrast — pure, deterministic color/contrast helpers for hero legibility.
 *
 * The carousel places Overlay_Text over a token-driven backing layer (a scrim)
 * that is composited between the background image and the text. Legibility must
 * be a *checkable property of the tokens* — not an accident of whichever image
 * happens to be behind a slide — so this module computes contrast purely from
 * color tokens (Requirement 5.1) and derives a backing-layer opacity from
 * bounded steps that guarantees a target contrast (Requirement 5.3).
 *
 * Everything here is pure and deterministic with no DOM access, so the
 * behaviour can be property-tested in isolation (design.md → Correctness
 * Properties 17 and 18) and reused by the presentation layer (`Carousel.astro`)
 * and by the token pipeline.
 *
 * The math follows the WCAG 2.x definitions:
 *   - relative luminance:  https://www.w3.org/TR/WCAG20/#relativeluminancedef
 *   - contrast ratio:      https://www.w3.org/TR/WCAG20/#contrast-ratiodef
 *
 * Design references:
 *   - design.md → Carousel legibility (token-driven scrim behind the text)
 *   - design.md → Correctness Properties 17, 18
 *   - Requirements 5.1, 5.3
 */

/** An sRGB color with 8-bit channels in the range 0..255. */
export type Rgb = { r: number; g: number; b: number };

/** Options that select which WCAG threshold a contrast ratio must meet. */
export type ContrastOptions = {
  /**
   * True for "large" text — 24px (18pt) or larger, or 18.66px (14pt) bold.
   * Large text only needs a 3:1 ratio; normal text needs 4.5:1.
   */
  largeText?: boolean;
};

/** WCAG minimum contrast ratio for normal-size text. */
export const CONTRAST_AA_NORMAL = 4.5;
/** WCAG minimum contrast ratio for large / bold text. */
export const CONTRAST_AA_LARGE = 3;

/**
 * Parse a CSS hex color (`#rgb` or `#rrggbb`, case-insensitive, `#` optional)
 * into an {@link Rgb} with 8-bit channels.
 *
 * The 3-digit shorthand expands each nibble by duplication (`#abc` → `#aabbcc`),
 * exactly as CSS does. Returns `null` for any input that is not a well-formed
 * 3- or 6-digit hex color, so callers can decide how to handle bad tokens
 * rather than silently rendering a wrong color.
 *
 * Pure and deterministic; the input string is not mutated.
 *
 * @param hex a hex color string such as `"#0074d4"`, `"0074d4"`, or `"#abc"`
 * @returns the parsed RGB, or `null` when the string is not a valid hex color
 */
export function parseHexColor(hex: string): Rgb | null {
  if (typeof hex !== "string") {
    return null;
  }
  const cleaned = hex.trim().replace(/^#/, "");

  // Only 3- or 6-digit hex is accepted; anything else is not a color token.
  if (!/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(cleaned)) {
    return null;
  }

  // Expand the 3-digit shorthand by duplicating each nibble (#abc -> #aabbcc).
  const full =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : cleaned;

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return { r, g, b };
}

/**
 * Linearize a single 8-bit sRGB channel to its linear-light value in [0, 1],
 * per the WCAG relative-luminance definition (the sRGB inverse companding /
 * gamma-expansion step). Channels at or below the small linear segment use the
 * `/12.92` branch; brighter channels use the gamma-expansion branch.
 */
function linearizeChannel(channel8bit: number): number {
  const c = channel8bit / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Compute the WCAG relative luminance of a color in [0, 1] (0 = black,
 * 1 = white). Uses the standard Rec. 709 luma weights on the linearized
 * channels.
 *
 * Pure and deterministic.
 *
 * @param color an sRGB color with 8-bit channels
 * @returns the relative luminance, a number in [0, 1]
 */
export function relativeLuminance(color: Rgb): number {
  const r = linearizeChannel(color.r);
  const g = linearizeChannel(color.g);
  const b = linearizeChannel(color.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Compute the WCAG contrast ratio between two luminances, always in [1, 21].
 *
 * The formula is `(Llighter + 0.05) / (Ldarker + 0.05)`; ordering the inputs so
 * the lighter one is on top keeps the result >= 1 regardless of argument order.
 *
 * @param lumA a relative luminance in [0, 1]
 * @param lumB a relative luminance in [0, 1]
 * @returns the contrast ratio in [1, 21]
 */
export function contrastRatioFromLuminance(lumA: number, lumB: number): number {
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Compute the WCAG contrast ratio between two colors, always in [1, 21].
 *
 * Symmetric in its arguments (`contrastRatio(a, b) === contrastRatio(b, a)`),
 * returns 1 for identical colors, and reaches 21 only for pure black vs. pure
 * white. Pure and deterministic.
 *
 * @param colorA the first sRGB color (e.g. the text color token)
 * @param colorB the second sRGB color (e.g. the backing-layer/scrim color)
 * @returns the contrast ratio in [1, 21]
 */
export function contrastRatio(colorA: Rgb, colorB: Rgb): number {
  return contrastRatioFromLuminance(
    relativeLuminance(colorA),
    relativeLuminance(colorB),
  );
}

/**
 * Decide whether a contrast `ratio` meets the WCAG AA threshold for the given
 * text size. Normal text needs >= 4.5:1; large/bold text needs >= 3:1.
 *
 * @param ratio a contrast ratio (typically from {@link contrastRatio})
 * @param options `{ largeText }` selects the 3:1 threshold for large/bold text
 * @returns true when the ratio meets the applicable AA threshold
 */
export function meetsContrast(
  ratio: number,
  options: ContrastOptions = {},
): boolean {
  const threshold = options.largeText ? CONTRAST_AA_LARGE : CONTRAST_AA_NORMAL;
  return ratio >= threshold;
}

/**
 * Alpha-composite a foreground color over an opaque background color at the
 * given `opacity` (the "source-over" / "over" operator), returning the opaque
 * composited color.
 *
 * This models the backing layer: a scrim color painted at `opacity` over the
 * (opaque) background produces the actual pixels sitting directly behind the
 * overlay text. `opacity` is clamped to [0, 1]; at 0 the result is the
 * background, at 1 it is the scrim.
 *
 * Pure and deterministic; inputs are not mutated.
 *
 * @param foreground the scrim color painted on top
 * @param background the opaque background beneath the scrim
 * @param opacity the scrim opacity in [0, 1] (values outside are clamped)
 * @returns the opaque composited color
 */
export function compositeOver(
  foreground: Rgb,
  background: Rgb,
  opacity: number,
): Rgb {
  const a = clamp01(opacity);
  return {
    r: foreground.r * a + background.r * (1 - a),
    g: foreground.g * a + background.g * (1 - a),
    b: foreground.b * a + background.b * (1 - a),
  };
}

/** Inputs for {@link stepScrimOpacity}. */
export type StepScrimOpacityInput = {
  /** The overlay text color token (the pixels the reader must read). */
  textColor: Rgb;
  /** The scrim color token composited over the background (e.g. a dark ink). */
  scrimColor: Rgb;
  /** The opaque background behind the scrim (e.g. an approximation of the image). */
  backgroundColor: Rgb;
  /** The contrast ratio the composited backing must achieve against the text. */
  targetRatio: number;
  /**
   * Number of opacity steps between 0 and 1 inclusive. Must be >= 10 so each
   * step is no larger than 10% (0, 0.1, ... 1.0 is the minimum granularity).
   * Defaults to 10. Larger values give finer steps (still bounded by 10%).
   */
  steps?: number;
};

/**
 * The result of {@link stepScrimOpacity}: the chosen opacity and whether it
 * actually reached the target contrast (vs. falling back to full opacity).
 */
export type StepScrimOpacityResult = {
  /** The chosen backing-layer opacity, one of the discrete steps in [0, 1]. */
  opacity: number;
  /** The contrast ratio of the text against the composited backing at `opacity`. */
  ratio: number;
  /** True when `opacity` actually met `targetRatio`; false when it fell back to 1.0. */
  reachedTarget: boolean;
};

/**
 * Choose the SMALLEST backing-layer (scrim) opacity — drawn from discrete steps
 * no larger than 10% apart (0, 0.1, ..., 1.0 by default) — that makes the
 * overlay text meet `targetRatio` against the scrim composited over the
 * background. If no step reaches the target, returns full opacity (1.0).
 *
 * Guarantees (design.md → Correctness Property 18):
 *   - The returned opacity is one of the discrete steps, each step <= 10% wide.
 *   - It is the smallest step meeting the target, so the function is monotonic
 *     in the number of steps searched and never over-darkens unnecessarily.
 *   - When the target is unreachable at every step, it returns 1.0 (max scrim).
 *   - It never returns an opacity that renders the text invisible: a step is
 *     only accepted when the text still has a *positive* contrast against the
 *     backing (ratio > 1), and the fallback of 1.0 composites the full scrim
 *     (not the text color), so the text is never painted onto itself.
 *
 * Because contrast against the scrim is monotonic in opacity for a fixed text
 * color (as opacity rises the backing approaches the scrim color), the smallest
 * qualifying step is well-defined. Pure and deterministic; inputs not mutated.
 *
 * @param input the text/scrim/background colors, target ratio, and step count
 * @returns the chosen opacity, its resulting ratio, and whether the target was met
 */
export function stepScrimOpacity(
  input: StepScrimOpacityInput,
): StepScrimOpacityResult {
  const { textColor, scrimColor, backgroundColor, targetRatio } = input;

  // At least 10 steps so each increment is <= 10% (Requirement 5.3). Guard
  // against callers asking for fewer/degenerate step counts.
  const steps = Math.max(10, Math.floor(input.steps ?? 10));
  const textLum = relativeLuminance(textColor);

  // Walk the discrete steps from lightest scrim (0) to fullest (1.0) and take
  // the FIRST (smallest) step that both meets the target and keeps the text
  // visible (positive contrast). Iterating low->high yields the minimum step.
  for (let i = 0; i <= steps; i++) {
    const opacity = i / steps;
    const backing = compositeOver(scrimColor, backgroundColor, opacity);
    const ratio = contrastRatioFromLuminance(
      textLum,
      relativeLuminance(backing),
    );
    // ratio > 1 ensures the text is not invisible (equal luminance -> ratio 1).
    if (ratio > 1 && ratio >= targetRatio) {
      return { opacity, ratio, reachedTarget: true };
    }
  }

  // Unreachable at every step -> fall back to full scrim opacity (1.0). This is
  // the maximum backing the scrim can provide; the text is composited over the
  // pure scrim color, never onto itself, so it is not rendered invisible here.
  const backing = compositeOver(scrimColor, backgroundColor, 1);
  const ratio = contrastRatioFromLuminance(textLum, relativeLuminance(backing));
  return { opacity: 1, ratio, reachedTarget: false };
}

/** Clamp a number to the [0, 1] range. */
function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
