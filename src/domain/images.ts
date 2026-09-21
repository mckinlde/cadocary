/**
 * Image resolution — pure, deterministic image-content correspondence.
 *
 * These functions centralize two concerns so that "which asset does this entity
 * render, and what happens when it has none" is a checkable property rather than
 * an authoring accident (the current DocketBot/ClientCheck slides both point at
 * the Highlighter screenshot precisely because slides carried a free-form
 * `image.src` with no structural link to the entity they illustrate):
 *
 *   1. An entity renders its OWN explicitly-associated asset and never another
 *      entity's (Requirements 6.1–6.3).
 *   2. A missing/empty image collapses to `{ kind: "none" }` so the caller can
 *      collapse the reserved image space rather than emit a broken reference
 *      (Requirement 6.5).
 *   3. Alt text falls back to the EMPTY STRING when absent and never exposes a
 *      filename, path, or placeholder token (Requirement 6.6).
 *
 * Both functions are intentionally pure (no DOM, no mutation of their inputs)
 * so the correspondence behavior can be property-tested in isolation and reused
 * by the presentation layer (Carousel / ProductCatalog / CaseStudyCollection).
 *
 * Design references:
 *   - design.md → Components and Interfaces → Image resolution helper
 *     (`src/domain/images.ts`)
 *   - design.md → Error Handling → Missing images
 *   - design.md → Correctness Properties 3, 4, 5
 */

import type { Slide } from "../types";

/**
 * The result of resolving an entity's image. Either a concrete asset to render
 * (`kind: "image"`) or an explicit signal that there is nothing to render
 * (`kind: "none"`), which tells the caller to collapse the image space instead
 * of emitting a broken reference.
 */
export type ResolvedImage =
  | { kind: "image"; src: string; alt: string }
  | { kind: "none" };

/**
 * Resolve the image to render for a visual entity from its explicit
 * association.
 *
 * Returns `{ kind: "none" }` when the entity has no image or its `src` is
 * absent/empty (after trimming), so callers collapse the reserved image area
 * and never render a broken reference (Requirement 6.5).
 *
 * When `src` is present, `alt` falls back to the EMPTY STRING `""` if it is
 * absent or empty. The fallback is deliberately the empty string and NEVER the
 * `src`, a filename, a path, or a placeholder token (Requirement 6.6): an image
 * whose alt would otherwise leak a path is better exposed to assistive tech as
 * decorative (empty alt) than as a confusing filename.
 *
 * Pure and deterministic — the input is not mutated.
 *
 * @param input an entity carrying an optional explicit `image`
 * @returns the asset to render, or `{ kind: "none" }`
 */
export function resolveImage(input: {
  image?: { src?: string; alt?: string };
}): ResolvedImage {
  const image = input.image;
  // No image object at all -> nothing to render.
  if (!image) {
    return { kind: "none" };
  }

  // Absent or blank src -> collapse the image space (no broken ref). We treat a
  // whitespace-only src as empty so authored `" "` cannot smuggle a broken img.
  const src = image.src;
  if (typeof src !== "string" || src.trim() === "") {
    return { kind: "none" };
  }

  // alt falls back to the empty string when missing/blank; it must never become
  // the src, a filename, a path, or a placeholder token.
  const alt = typeof image.alt === "string" ? image.alt : "";

  return { kind: "image", src, alt };
}

/**
 * Resolve the image to render for a carousel `slide`.
 *
 * Precedence (Requirements 6.1, 6.2, 6.3):
 *   1. The slide's OWN explicit `image`, when it resolves to a concrete asset.
 *   2. Otherwise, if the slide carries a `ref`, the referenced entity's own
 *      explicit `image`, looked up via `byId(ref)`.
 *   3. Otherwise `{ kind: "none" }`.
 *
 * By construction the resolved asset is always either the slide's own image or
 * the referenced entity's image — never any other entity's image. The lookup is
 * delegated to `byId` so this module stays free of content-loading concerns.
 *
 * Pure and deterministic given a pure `byId`; the inputs are not mutated.
 *
 * @param slide the slide to resolve an image for
 * @param byId resolves an entity id to that entity's optional explicit image
 * @returns the asset to render, or `{ kind: "none" }`
 */
export function resolveSlideImage(
  slide: Slide,
  byId: (ref: string) => { image?: { src: string; alt: string } } | undefined,
): ResolvedImage {
  // 1. A slide's own explicit image always wins when it resolves.
  const own = resolveImage(slide);
  if (own.kind === "image") {
    return own;
  }

  // 2. Fall back to the referenced entity's own explicit image.
  if (typeof slide.ref === "string" && slide.ref !== "") {
    const entity = byId(slide.ref);
    if (entity) {
      return resolveImage(entity);
    }
  }

  // 3. Nothing to render -> collapse the image space.
  return { kind: "none" };
}
