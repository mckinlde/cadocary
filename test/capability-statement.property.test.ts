import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { countCapabilities, namedCapabilities } from "../src/domain/capability";
import type { CapabilityStatement, ContentBlock } from "../src/types";
import missionSeed from "../src/content/mission.json";

/**
 * Feature: corporate-site-positioning, Property 7: Capability_Statement names at
 * least three distinct capabilities
 *
 * For any valid Capability_Statement (authored as a set of named concrete
 * capabilities — the items of its `list` block(s)), the number of DISTINCT named
 * capabilities is at least 3.
 *
 * Validates: Requirements 2.4
 *
 * Strategy:
 *   - Generated: build Capability_Statements from a pool of distinct capability
 *     labels (optionally mixed with duplicates, blank items, and non-list
 *     blocks that must NOT be counted). We assert the counting helper reports a
 *     count of AT LEAST 3 exactly when at least 3 distinct non-blank labels are
 *     present, and that distinctness is enforced (duplicates and blanks don't
 *     inflate the count).
 *   - Real seed: import the shipped mission.json capability block and assert it
 *     names ≥ 3 distinct capabilities.
 */

const MIN_ITERATIONS = 100;

/** A pool of realistic, distinct capability labels. */
const capabilityLabels = [
  "Web platforms",
  "Native mobile apps",
  "Data pipelines",
  "AI/ML integration",
  "Automation",
  "Web scraping",
  "API design",
  "Cloud infrastructure",
];

describe("Feature: corporate-site-positioning, Property 7: Capability_Statement names >= 3 distinct capabilities", () => {
  it("counts >= 3 exactly when >= 3 distinct non-blank capabilities are named", () => {
    fc.assert(
      fc.property(
        // A subset of distinct labels (0..all), possibly empty.
        fc.uniqueArray(fc.constantFrom(...capabilityLabels), {
          minLength: 0,
          maxLength: capabilityLabels.length,
        }),
        // Extra noise indices selecting duplicates FROM the chosen subset, and
        // blank/whitespace strings — neither may introduce a NEW distinct label
        // nor inflate the count.
        fc.array(fc.oneof(fc.nat(), fc.constantFrom("", "   ", "\t")), {
          minLength: 0,
          maxLength: 6,
        }),
        (distinct, noiseSeeds) => {
          // Map numeric seeds to duplicates of already-chosen labels (so noise
          // never adds a new distinct capability); keep blank strings as-is.
          // When `distinct` is empty, numeric seeds contribute nothing.
          const noise: string[] = noiseSeeds.flatMap((seed) => {
            if (typeof seed === "string") return [seed];
            return distinct.length === 0 ? [] : [distinct[seed % distinct.length]];
          });

          // Interleave distinct labels with noise; also split across two list
          // blocks to prove counting aggregates across list blocks.
          const allItems = [...distinct, ...noise];
          const mid = Math.floor(allItems.length / 2);
          const body: ContentBlock[] = [
            { type: "paragraph", text: "Intro copy (not a capability)." },
            { type: "list", items: allItems.slice(0, mid) },
            { type: "heading", level: 3, text: "More (not a capability)." },
            { type: "list", items: allItems.slice(mid) },
          ];
          const capability: CapabilityStatement = {
            heading: "What Cadocary builds",
            body,
          };

          const count = countCapabilities(capability);
          const names = namedCapabilities(capability);

          // The distinct non-blank labels present are exactly `distinct`
          // (noise duplicates collapse; blanks are ignored). Comparison is
          // case-insensitive but our pool has distinct casings, so distinct
          // count equals the chosen subset size.
          expect(count).toBe(distinct.length);

          // Distinctness: no duplicate labels (case-insensitive) survive.
          const lowered = names.map((n) => n.toLowerCase());
          expect(new Set(lowered).size).toBe(names.length);

          // The core property: >= 3 iff at least 3 distinct capabilities named.
          expect(count >= 3).toBe(distinct.length >= 3);
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });

  it("does not count paragraph/heading text or duplicate items as capabilities", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.constantFrom(...capabilityLabels), {
          minLength: 3,
          maxLength: capabilityLabels.length,
        }),
        (distinct) => {
          const capability: CapabilityStatement = {
            heading: "What Cadocary builds",
            body: [
              // Non-list blocks whose text repeats capability words must be ignored.
              { type: "paragraph", text: distinct.join(" and ") },
              { type: "heading", level: 3, text: distinct[0] },
              // The real list, with every label duplicated once.
              { type: "list", items: [...distinct, ...distinct] },
            ],
          };

          // Duplicates collapse; non-list text is never counted.
          expect(countCapabilities(capability)).toBe(distinct.length);
          expect(countCapabilities(capability)).toBeGreaterThanOrEqual(3);
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });
});

describe("Feature: corporate-site-positioning, Property 7: real seed capability statement", () => {
  it("the shipped mission.json capability block names >= 3 distinct capabilities", () => {
    const mission = missionSeed as { capability?: CapabilityStatement };
    expect(mission.capability).toBeDefined();

    const capability = mission.capability as CapabilityStatement;
    const names = namedCapabilities(capability);

    // >= 3 distinct capabilities (Requirement 2.4).
    expect(countCapabilities(capability)).toBeGreaterThanOrEqual(3);

    // And they are genuinely distinct (case-insensitive).
    const lowered = names.map((n) => n.toLowerCase());
    expect(new Set(lowered).size).toBe(names.length);
  });
});
