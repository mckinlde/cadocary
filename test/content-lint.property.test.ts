import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  containsBannedSuperlative,
  containsPlaceholder,
  isRealCopy,
  BANNED_SUPERLATIVES,
} from "../src/domain/content-lint";
import type {
  CaseStudy,
  ContentBlock,
  ServiceOffering,
  ServicesPage,
} from "../src/types";
import servicesSeed from "../src/content/services.json";
import caseStudiesSeed from "../src/content/caseStudies.json";

/**
 * Feature: corporate-site-positioning, Property 19: Service copy contains no
 * banned standalone superlatives
 *
 * For any authored Service_Offering description, the copy does not contain the
 * standalone terms "best", "world-class", or "cutting-edge" as descriptive
 * claims.
 *
 * Validates: Requirements 3.6
 *
 * Strategy:
 *   - Generated: assemble descriptions from "clean" filler words plus, on a
 *     controlled toggle, an injected banned term as a standalone word. Assert
 *     the lint flags the copy exactly when a banned term was injected as a
 *     standalone token, and NOT when a banned term appears only as a substring
 *     of a larger word (e.g. "bestseller", "cutting board").
 *   - Real seed: assert every shipped services.json description is clean.
 */

const MIN_ITERATIONS = 100;

// Clean words that never contain a banned standalone superlative.
const cleanWords = [
  "we",
  "design",
  "build",
  "and",
  "implement",
  "custom",
  "software",
  "for",
  "the",
  "client",
  "delivering",
  "working",
  "outcomes",
  "end",
  "to",
];

describe("Feature: corporate-site-positioning, Property 19: Service copy contains no banned standalone superlatives", () => {
  it("flags copy exactly when a banned superlative appears as a standalone term", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...cleanWords), {
          minLength: 1,
          maxLength: 20,
        }),
        fc.boolean(), // whether to inject a banned term
        fc.constantFrom(...BANNED_SUPERLATIVES),
        fc.nat(), // insertion position
        (words, inject, banned, posSeed) => {
          const parts = [...words];
          if (inject) {
            const pos = posSeed % (parts.length + 1);
            parts.splice(pos, 0, banned);
          }
          const text = parts.join(" ") + ".";

          expect(containsBannedSuperlative(text)).toBe(inject);
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });

  it("does NOT flag banned terms embedded as substrings of larger words", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          "bestseller",
          "unbested",
          "cutting board on the counter",
          "worldclass",
          "the class was worldly",
          "we cut the edge case",
        ),
        (phrase) => {
          const text = `Our team ${phrase} while shipping software.`;
          expect(containsBannedSuperlative(text)).toBe(false);
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });
});

describe("Feature: corporate-site-positioning, Property 19: real seed service copy", () => {
  it("every shipped Service_Offering description is free of banned standalone superlatives", () => {
    const services = servicesSeed as ServicesPage;
    for (const offering of services.offerings as ServiceOffering[]) {
      expect(containsBannedSuperlative(offering.description)).toBe(false);
    }
  });
});

/**
 * Feature: corporate-site-positioning, Property 20: Services and Case_Study
 * section copy is real, not placeholder
 *
 * For any authored Service_Offering description and any Case_Study section body,
 * the copy is non-empty (at least one sentence) and contains no placeholder
 * markers such as "Lorem ipsum" or "TODO".
 *
 * Validates: Requirements 8.5
 *
 * Strategy:
 *   - Generated: build strings that are (a) real non-empty copy, (b) blank /
 *     whitespace-only, or (c) contain a placeholder marker, and assert
 *     `isRealCopy` accepts exactly the real, marker-free, non-empty ones.
 *   - Real seed: assert every shipped services.json description and every text
 *     block within every Case_Study section body is real, non-empty, and
 *     placeholder-free.
 */

/** Extract all human-readable text fragments from a ContentBlock. */
function textFragments(block: ContentBlock): string[] {
  switch (block.type) {
    case "paragraph":
      return [block.text];
    case "heading":
      return [block.text];
    case "list":
      return block.items;
    case "image":
      return []; // alt text is not body copy for this lint
  }
}

describe("Feature: corporate-site-positioning, Property 20: copy is real, not placeholder", () => {
  it("isRealCopy accepts exactly non-empty, placeholder-free copy", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // (a) real copy: non-empty, no markers
          fc
            .array(fc.constantFrom(...cleanWords), {
              minLength: 1,
              maxLength: 12,
            })
            .map((w) => ({ text: w.join(" ") + ".", real: true })),
          // (b) blank / whitespace-only
          fc
            .constantFrom("", "   ", "\t", "\n  \n")
            .map((s) => ({ text: s, real: false })),
          // (c) contains a placeholder marker
          fc
            .constantFrom(
              "Lorem ipsum dolor sit amet",
              "TODO: write this section",
              "intro lorem ipsum tail",
              "section todo",
            )
            .map((s) => ({ text: s, real: false })),
        ),
        ({ text, real }) => {
          expect(isRealCopy(text)).toBe(real);
          if (!real && text.trim().length > 0) {
            // The non-empty failing cases are exactly the placeholder ones.
            expect(containsPlaceholder(text)).toBe(true);
          }
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });
});

describe("Feature: corporate-site-positioning, Property 20: real seed copy", () => {
  it("every shipped Service_Offering description is real, non-empty, placeholder-free", () => {
    const services = servicesSeed as ServicesPage;
    expect(services.offerings.length).toBeGreaterThan(0);
    for (const offering of services.offerings as ServiceOffering[]) {
      expect(isRealCopy(offering.description)).toBe(true);
    }
  });

  it("every Case_Study section body fragment is real, non-empty, placeholder-free", () => {
    const caseStudies = caseStudiesSeed as unknown as CaseStudy[];
    expect(caseStudies.length).toBeGreaterThan(0);

    for (const cs of caseStudies) {
      for (const section of cs.sections) {
        // Each section must carry at least one text fragment.
        const fragments = section.body.flatMap(textFragments);
        expect(fragments.length).toBeGreaterThan(0);
        for (const fragment of fragments) {
          expect(isRealCopy(fragment)).toBe(true);
        }
      }
    }
  });
});
