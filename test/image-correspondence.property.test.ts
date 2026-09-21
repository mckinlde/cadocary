import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { resolveImage, resolveSlideImage } from "../src/domain/images";
import type { Slide } from "../src/types";

/**
 * Image-content correspondence & graceful degradation properties for the pure
 * `resolveImage` / `resolveSlideImage` helpers in `src/domain/images.ts`.
 *
 * These tests validate that the render layer resolves an entity's OWN image
 * (never another entity's), resolves a slide's image from its own explicit
 * image or its referenced entity, and collapses gracefully when an image or its
 * alt text is missing.
 *
 * Testing framework: vitest + fast-check (numRuns: 200), matching the repo style.
 */

const NUM_RUNS = 200;

/**
 * A non-empty, non-blank asset path arbitrary. `resolveImage` treats a blank /
 * whitespace-only `src` as "no image", so distinct-image scenarios draw from
 * concrete-looking paths.
 */
const assetSrc = fc
  .string({ minLength: 1, maxLength: 24 })
  .map((s) => `/img/${s.replace(/\s/g, "_")}.png`)
  .filter((s) => s.trim() !== "");

const altText = fc.string({ maxLength: 40 });

describe("Feature: corporate-site-positioning, Property 3: Image-content correspondence for products and case studies", () => {
  // A visual entity (Product or Case_Study) carries an explicit `image`. Each
  // entity in the generated set is given a DISTINCT src so "returns E's own,
  // never another's" is a meaningful, falsifiable claim.
  it("resolveImage(E) returns E's own src and never another entity's src", () => {
    fc.assert(
      fc.property(
        // A set of entities with pairwise-distinct srcs, plus which one is E.
        fc
          .uniqueArray(assetSrc, { minLength: 1, maxLength: 8 })
          .chain((srcs) =>
            fc.record({
              srcs: fc.constant(srcs),
              index: fc.integer({ min: 0, max: srcs.length - 1 }),
              alts: fc.array(altText, {
                minLength: srcs.length,
                maxLength: srcs.length,
              }),
            }),
          ),
        ({ srcs, index, alts }) => {
          const entities = srcs.map((src, i) => ({
            image: { src, alt: alts[i] ?? "" },
          }));
          const E = entities[index];

          const resolved = resolveImage(E);

          // E resolves to a concrete image (its src is non-blank by construction).
          expect(resolved.kind).toBe("image");
          if (resolved.kind !== "image") return;

          // (1) It returns E's OWN src.
          expect(resolved.src).toBe(E.image.src);

          // (2) It never returns any OTHER entity's src.
          const otherSrcs = entities
            .filter((_, i) => i !== index)
            .map((e) => e.image.src);
          expect(otherSrcs).not.toContain(resolved.src);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("Feature: corporate-site-positioning, Property 4: Slide image correspondence via explicit reference", () => {
  // Build a slide referencing entity R among a set of entities with distinct
  // images. When the slide has its own image, that wins; otherwise R's image is
  // used; and never any entity other than R.
  it("resolveSlideImage returns the slide's own image if present, else the referenced entity's, never another entity's", () => {
    fc.assert(
      fc.property(
        fc
          .uniqueArray(assetSrc, { minLength: 1, maxLength: 6 })
          .chain((entitySrcs) =>
            fc.record({
              // Distinct srcs, one per entity keyed by id "e0".."eN".
              entitySrcs: fc.constant(entitySrcs),
              refIndex: fc.integer({ min: 0, max: entitySrcs.length - 1 }),
              // The slide MAY carry its own explicit image (distinct token) or not.
              ownSrc: fc.option(
                assetSrc.map((s) => `/own${s}`),
                { nil: undefined },
              ),
              ownAlt: altText,
              refAlt: altText,
            }),
          ),
        ({ entitySrcs, refIndex, ownSrc, ownAlt, refAlt }) => {
          // Map each entity id -> its own distinct image.
          const entities = new Map<string, { image: { src: string; alt: string } }>();
          entitySrcs.forEach((src, i) => {
            entities.set(`e${i}`, { image: { src, alt: `${refAlt}-${i}` } });
          });
          const refId = `e${refIndex}`;
          const refSrc = entitySrcs[refIndex];

          const byId = (ref: string) => entities.get(ref);

          const slide: Slide = {
            id: "slide",
            heading: "heading",
            ref: refId,
            ...(ownSrc ? { image: { src: ownSrc, alt: ownAlt } } : {}),
          };

          const resolved = resolveSlideImage(slide, byId);

          expect(resolved.kind).toBe("image");
          if (resolved.kind !== "image") return;

          if (ownSrc) {
            // (1) The slide's own explicit image wins.
            expect(resolved.src).toBe(ownSrc);
            expect(resolved.alt).toBe(ownAlt);
          } else {
            // (2) Otherwise the referenced entity R's image is used.
            expect(resolved.src).toBe(refSrc);
          }

          // (3) Never an image associated with an entity OTHER than R (and,
          //     when the slide has its own image, never any entity's src).
          const otherEntitySrcs = entitySrcs.filter((_, i) => i !== refIndex);
          expect(otherEntitySrcs).not.toContain(resolved.src);
          if (ownSrc) {
            expect(entitySrcs).not.toContain(resolved.src);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("returns { kind: 'none' } when the slide has no own image and its ref does not resolve", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 8 }), (ref) => {
        const slide: Slide = { id: "slide", heading: "heading", ref };
        // byId resolves nothing.
        const resolved = resolveSlideImage(slide, () => undefined);
        expect(resolved).toEqual({ kind: "none" });
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("Feature: corporate-site-positioning, Property 5: Graceful image resolution (missing image and missing alt)", () => {
  // Tokens that must NEVER leak into alt text when alt is missing.
  const forbiddenAltSubstrings = ["placeholder", "TODO", "image", "img"];

  it("absent src resolves to { kind: 'none' } (no broken reference)", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // No image object at all.
          fc.constant<{ image?: { src?: string; alt?: string } }>({}),
          // image present but src absent.
          fc.record({ image: fc.record({ alt: altText }) }),
          // image present but src blank / whitespace-only.
          fc.record({
            image: fc.record({
              src: fc.constantFrom("", " ", "   ", "\t", "\n"),
              alt: altText,
            }),
          }),
        ),
        (entity) => {
          expect(resolveImage(entity)).toEqual({ kind: "none" });
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("present src with missing alt resolves alt to exactly '' and never the src/filename/path/token", () => {
    fc.assert(
      fc.property(
        fc.record({
          src: assetSrc,
          // alt is MISSING: either omitted or a non-string, so resolveImage
          // must fall back to the empty string.
          altMissing: fc.constant(true),
        }),
        ({ src }) => {
          // Entity carries a src but NO alt property.
          const entity: { image?: { src?: string; alt?: string } } = {
            image: { src },
          };

          const resolved = resolveImage(entity);

          expect(resolved.kind).toBe("image");
          if (resolved.kind !== "image") return;

          // (1) Missing alt falls back to exactly the empty string.
          expect(resolved.alt).toBe("");

          // (2) The alt is NOT the src, and contains no filename/path/token.
          expect(resolved.alt).not.toBe(src);
          expect(resolved.alt).not.toContain("/");
          expect(resolved.alt).not.toContain(".png");
          for (const token of forbiddenAltSubstrings) {
            expect(resolved.alt.toLowerCase()).not.toContain(
              token.toLowerCase(),
            );
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("present src preserves an authored alt verbatim", () => {
    fc.assert(
      fc.property(assetSrc, altText, (src, alt) => {
        const resolved = resolveImage({ image: { src, alt } });
        expect(resolved).toEqual({ kind: "image", src, alt });
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
