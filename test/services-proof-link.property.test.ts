import { describe, expect, test } from "vitest";
import fc from "fast-check";

import { serviceOfferingCard } from "../src/domain/cards";
import type { CaseStudy, CaseStudySection, ServiceOffering } from "../src/types";

/**
 * Feature: corporate-site-positioning, Property 14: Service_Offering proof-link derivation
 *
 * Validates: Requirements 3.7, 3.8
 *
 * For any Service_Offering, `serviceOfferingCard(offering, caseStudyById)`
 * derives its proof link entirely from whether `caseStudyRef` resolves:
 *
 *  - When `caseStudyRef` is a non-empty string that resolves (via the provided
 *    `caseStudyById`) to an existing Case_Study, the resulting `proofHref` is
 *    EXACTLY `/work/{slug}` for that case study (Requirement 3.7).
 *  - When `caseStudyRef` is absent, empty, or does not resolve to a case study,
 *    `proofHref` is omitted entirely — never present, never an empty or broken
 *    href (Requirement 3.8).
 *
 * Strategy: generate a known registry of case studies (a byId resolver), then
 * generate an offering whose `caseStudyRef` is one of four flavors: a ref that
 * IS in the registry (should resolve), a ref that is NOT in the registry (should
 * not resolve), the empty string, or absent. Each generated case builds both the
 * registry and the offering together, so a single flat property exercises both
 * the resolved and unresolved branches against the same resolver.
 */

const MIN_ITERATIONS = 100;

/** A minimal valid case-study section body. */
const sectionArb: fc.Arbitrary<CaseStudySection> = fc.record({
  kind: fc.constantFrom<CaseStudySection["kind"]>(
    "problem",
    "approach",
    "whatWasBuilt",
    "outcome",
  ),
  body: fc.constant([{ type: "paragraph" as const, text: "copy" }]),
});

/**
 * Arbitrary Case_Study with the given `id`/`slug`. Only `id` and `slug` drive
 * the proof-link derivation; the rest are structurally valid placeholders.
 */
function caseStudyArb(id: string, slug: string): fc.Arbitrary<CaseStudy> {
  return fc.record({
    name: fc.string(),
    description: fc.string(),
    clientName: fc.string(),
    clientSiteUrl: fc.webUrl(),
    engagementRole: fc.string(),
    deliverable: fc.string(),
    sections: fc.array(sectionArb, { minLength: 1, maxLength: 4 }),
    id: fc.constant(id),
    slug: fc.constant(slug),
    order: fc.integer(),
    detailPageId: fc.string({ minLength: 1 }),
  });
}

/** Arbitrary base Service_Offering fields, minus the `caseStudyRef` we control. */
const offeringBaseArb = fc.record({
  name: fc.string(),
  description: fc.string(),
  id: fc.string({ minLength: 1 }),
  order: fc.integer(),
});

/**
 * A full scenario: a set of known case studies (with unique ids), and a choice
 * of how the offering's `caseStudyRef` is derived from them.
 */
const scenarioArb = fc
  .uniqueArray(
    fc.record({
      id: fc.string({ minLength: 1, maxLength: 12 }),
      slug: fc.string({ minLength: 1, maxLength: 12 }),
    }),
    { minLength: 1, maxLength: 5, selector: (e) => e.id },
  )
  .chain((entries) =>
    fc.record({
      studies: fc.tuple(...entries.map((e) => caseStudyArb(e.id, e.slug))),
      entries: fc.constant(entries),
      base: offeringBaseArb,
      // Ref selection: resolve to a known id, an unknown ref, empty, or absent.
      choice: fc.oneof(
        fc.record({
          mode: fc.constant<"known">("known"),
          pick: fc.nat(),
        }),
        fc.record({
          mode: fc.constant<"unknown">("unknown"),
          ref: fc.string(),
        }),
        fc.constant<{ mode: "empty" }>({ mode: "empty" }),
        fc.constant<{ mode: "absent" }>({ mode: "absent" }),
      ),
    }),
  );

describe("Property 14: Service_Offering proof-link derivation", () => {
  test("proofHref is /work/{slug} when caseStudyRef resolves, omitted otherwise", () => {
    fc.assert(
      fc.property(scenarioArb, ({ studies, entries, base, choice }) => {
        const registry = new Map<string, CaseStudy>();
        studies.forEach((cs, i) => registry.set(entries[i].id, cs));
        const caseStudyById = (ref: string) => registry.get(ref);

        let caseStudyRef: string | undefined;
        let expectResolved = false;

        if (choice.mode === "known") {
          const entry = entries[choice.pick % entries.length];
          caseStudyRef = entry.id;
          expectResolved = true;
        } else if (choice.mode === "unknown") {
          // Force a value that is definitely not a known id.
          caseStudyRef = registry.has(choice.ref)
            ? `${choice.ref}\u0000not-a-real-id`
            : choice.ref;
          // Empty string is treated as "no ref" by the derivation, so exclude it.
          expectResolved = caseStudyRef !== "" && registry.has(caseStudyRef);
        } else if (choice.mode === "empty") {
          caseStudyRef = "";
        } else {
          caseStudyRef = undefined;
        }

        const offering: ServiceOffering = { ...base, caseStudyRef };
        const card = serviceOfferingCard(offering, caseStudyById);

        if (expectResolved && caseStudyRef !== undefined) {
          const cs = registry.get(caseStudyRef)!;
          expect(card.proofHref).toBe(`/work/${cs.slug}`);
        } else {
          // Absent / empty / unresolved -> no proof link at all (never broken).
          expect(card.proofHref).toBeUndefined();
        }
      }),
      { numRuns: MIN_ITERATIONS },
    );
  });
});
