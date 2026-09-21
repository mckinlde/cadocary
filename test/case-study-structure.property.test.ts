import { describe, expect, test } from "vitest";
import fc from "fast-check";

import { orderedCaseStudySections } from "../src/domain/cards";
import type { CaseStudy, CaseStudySection, ContentBlock } from "../src/types";

/**
 * Feature: corporate-site-positioning, Property 10: Case_Study has the four
 * required sections exposed in fixed order
 *
 * Validates: Requirements 4.2, 4.5
 *
 * For any valid Case_Study, the set of its section kinds equals exactly
 * `{problem, approach, whatWasBuilt, outcome}` (each present exactly once), and
 * `orderedCaseStudySections(cs)` exposes those four sections in the fixed order
 * problem → approach → whatWasBuilt → outcome — regardless of the order the
 * sections were authored in — with each section carrying its authored body
 * verbatim.
 *
 * Strategy: the four sections are generated in a RANDOM (shuffled) authored
 * order via a permutation of the four kinds, each paired with a small,
 * kind-distinct body. We then build a valid CaseStudy and assert that the
 * ordered exposure is always the canonical fixed order, that exactly the four
 * kinds appear (each once), and that every body matches the body authored for
 * that kind.
 */
describe("Property 10: Case_Study has the four required sections exposed in fixed order", () => {
  const KINDS: ReadonlyArray<CaseStudySection["kind"]> = [
    "problem",
    "approach",
    "whatWasBuilt",
    "outcome",
  ];

  /** All 24 permutations of the four fixed section kinds. */
  function permutations<T>(items: readonly T[]): T[][] {
    if (items.length <= 1) return [items.slice()];
    const result: T[][] = [];
    items.forEach((item, index) => {
      const rest = [...items.slice(0, index), ...items.slice(index + 1)];
      for (const perm of permutations(rest)) {
        result.push([item, ...perm]);
      }
    });
    return result;
  }

  const KIND_PERMUTATIONS = permutations(KINDS);

  // A small non-empty content body. Bodies are what must be preserved verbatim,
  // so we generate a couple of block shapes with arbitrary text.
  const contentBlock: fc.Arbitrary<ContentBlock> = fc.oneof(
    fc.record({
      type: fc.constant("paragraph" as const),
      text: fc.string({ minLength: 1, maxLength: 40 }),
    }),
    fc.record({
      type: fc.constant("heading" as const),
      level: fc.constantFrom(2 as const, 3 as const, 4 as const),
      text: fc.string({ minLength: 1, maxLength: 40 }),
    }),
  );

  const body: fc.Arbitrary<ContentBlock[]> = fc.array(contentBlock, {
    minLength: 1,
    maxLength: 3,
  });

  // A valid CaseStudy whose sections are authored in a RANDOM (shuffled) order:
  // pick one of the 24 kind permutations, then give each kind its own body.
  const caseStudy: fc.Arbitrary<{
    caseStudy: CaseStudy;
    bodiesByKind: Record<CaseStudySection["kind"], ContentBlock[]>;
    authoredOrder: ReadonlyArray<CaseStudySection["kind"]>;
  }> = fc
    .record({
      authoredOrder: fc.constantFrom(...KIND_PERMUTATIONS),
      problemBody: body,
      approachBody: body,
      whatWasBuiltBody: body,
      outcomeBody: body,
      name: fc.string({ maxLength: 120 }),
      description: fc.string({ maxLength: 300 }),
      clientName: fc.string(),
      clientSiteUrl: fc.webUrl(),
      engagementRole: fc.string(),
      deliverable: fc.string(),
      slug: fc.string(),
      detailPageId: fc.string(),
      order: fc.integer({ min: 0, max: 10 }),
    })
    .map((r) => {
      const bodiesByKind: Record<CaseStudySection["kind"], ContentBlock[]> = {
        problem: r.problemBody,
        approach: r.approachBody,
        whatWasBuilt: r.whatWasBuiltBody,
        outcome: r.outcomeBody,
      };
      // Author the sections in the randomly chosen (shuffled) order.
      const sections: CaseStudySection[] = r.authoredOrder.map((kind) => ({
        kind,
        body: bodiesByKind[kind],
      }));
      const caseStudy: CaseStudy = {
        name: r.name,
        description: r.description,
        clientName: r.clientName,
        clientSiteUrl: r.clientSiteUrl,
        engagementRole: r.engagementRole,
        deliverable: r.deliverable,
        sections,
        id: "case-study",
        slug: r.slug,
        order: r.order,
        detailPageId: r.detailPageId,
      };
      return { caseStudy, bodiesByKind, authoredOrder: r.authoredOrder };
    });

  test("orderedCaseStudySections exposes the four kinds in fixed order with authored bodies", () => {
    fc.assert(
      fc.property(caseStudy, ({ caseStudy, bodiesByKind }) => {
        const ordered = orderedCaseStudySections(caseStudy);

        // (1) Exactly four sections are exposed.
        expect(ordered).toHaveLength(4);

        // (2) The kinds appear in the canonical FIXED order, regardless of the
        //     authored order.
        expect(ordered.map((s) => s.kind)).toEqual([
          "problem",
          "approach",
          "whatWasBuilt",
          "outcome",
        ]);

        // (3) The set of kinds equals exactly the four required kinds, each
        //     present exactly once.
        const kindSet = new Set(ordered.map((s) => s.kind));
        expect(kindSet.size).toBe(4);
        for (const kind of KINDS) {
          expect(kindSet.has(kind)).toBe(true);
        }

        // (4) Each exposed section carries the body authored for that kind
        //     (verbatim).
        for (const section of ordered) {
          expect(section.body).toEqual(bodiesByKind[section.kind]);
        }
      }),
      { numRuns: 200 },
    );
  });
});
