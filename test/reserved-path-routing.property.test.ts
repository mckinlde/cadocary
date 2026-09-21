import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { resolveRoute } from "../src/domain/router";
import { RESERVED_PATHS } from "../src/domain/content-loader";
import type { IA, PageRef, Product, CaseStudy, Section } from "../src/types";

/**
 * Feature: corporate-site-positioning, Property 2: Reserved paths resolve to
 * not-found with reason "reserved"
 *
 * For any reserved path (`/search`, `/login`, `/register`, including
 * trailing-slash / query / fragment / whitespace variants that `resolveRoute`
 * normalizes), `resolveRoute` returns a `not-found` result with reason
 * `"reserved"`, checked BEFORE any other match, so search/login/registration
 * functionality is never exposed.
 *
 * Validates: Requirements 10.4
 *
 * Strategy: we generate a structurally valid IA (sections with pages whose ids
 * and paths are unique and NONE of which is a reserved path) plus arbitrary
 * product/case-study catalogs. Independently we pick a reserved path from
 * RESERVED_PATHS and optionally append a trailing slash and/or a query/fragment
 * suffix and/or surrounding whitespace — inputs `resolveRoute` is documented to
 * normalize. Because the IA generator excludes reserved paths, the reserved-path
 * rejection is exercised on its own merits (defence in depth, i.e. it is checked
 * before any other match) rather than merely because the path happens not to be
 * authored. We then assert the result is always `not-found` with reason
 * `"reserved"`.
 *
 * (Historical note: this file previously validated the prior website-redesign
 * "Property 13". The router now resolves the `/work/:slug` case-study family and
 * takes a `CaseStudy[]` as its final argument, so the case-study catalog is
 * generated as `CaseStudy[]` here.)
 */

const MIN_ITERATIONS = 100;

/**
 * A generator for a non-reserved, non-parameterized-detail path segment. We keep
 * paths to a single lowercase-alnum segment (e.g. "/about") so uniqueness is
 * easy to reason about and no generated path can collide with a reserved path or
 * with the `/products/` and `/work/` detail prefixes.
 */
const segmentArb = fc
  .stringMatching(/^[a-z][a-z0-9-]{0,15}$/)
  .filter((s) => s.length > 0);

/** A slug generator for products/case studies (single alnum segment). */
const slugArb = fc
  .stringMatching(/^[a-z][a-z0-9-]{0,15}$/)
  .filter((s) => s.length > 0);

/**
 * Build a valid IA from a set of unique segment names. Every page gets a unique
 * id and a unique path `/<segment>`; none of these can be a reserved path since
 * reserved paths (`/search`, `/login`, `/register`) are excluded below.
 */
function makeIA(segments: string[]): IA {
  const usable = segments.filter((s) => !RESERVED_PATHS.includes(`/${s}`));
  const pages: PageRef[] = usable.map((seg, i) => ({
    id: `page-${i}`,
    label: `Page ${i}`,
    path: `/${seg}`,
  }));

  const section: Section = {
    id: "main",
    label: "Main",
    order: 0,
    pages,
  };

  return { defaultSectionId: "main", sections: [section] };
}

/** Arbitrary valid IA with unique, non-reserved single-segment page paths. */
const iaArb: fc.Arbitrary<IA> = fc
  .uniqueArray(segmentArb, { minLength: 0, maxLength: 8 })
  .map(makeIA);

/** Arbitrary product catalog with unique slugs. */
const productsArb: fc.Arbitrary<Product[]> = fc
  .uniqueArray(slugArb, { minLength: 0, maxLength: 5 })
  .map((slugs) =>
    slugs.map((slug, i) => ({
      name: `Product ${i}`,
      description: `Description ${i}`,
      id: `prod-${i}`,
      slug,
      order: i,
      detailPageId: `page-prod-${i}`,
    })),
  );

/** Arbitrary case-study catalog with unique slugs. */
const caseStudiesArb: fc.Arbitrary<CaseStudy[]> = fc
  .uniqueArray(slugArb, { minLength: 0, maxLength: 5 })
  .map((slugs) =>
    slugs.map((slug, i) => ({
      name: `Case Study ${i}`,
      description: `Description ${i}`,
      clientName: `Client ${i}`,
      clientSiteUrl: `https://client-${i}.example.com`,
      engagementRole: "design + implementation consultancy",
      deliverable: `Deliverable ${i}`,
      sections: [
        { kind: "problem" as const, body: [] },
        { kind: "approach" as const, body: [] },
        { kind: "whatWasBuilt" as const, body: [] },
        { kind: "outcome" as const, body: [] },
      ],
      id: `cs-${i}`,
      slug,
      order: i,
      detailPageId: `page-cs-${i}`,
    })),
  );

/**
 * A reserved path, optionally decorated with a trailing slash and/or a
 * query-string or fragment suffix and/or surrounding whitespace — all of which
 * `resolveRoute` normalizes away before the reserved-path check. This exercises
 * that normalization.
 */
const reservedPathArb: fc.Arbitrary<string> = fc
  .record({
    base: fc.constantFrom(...RESERVED_PATHS),
    trailingSlash: fc.boolean(),
    suffix: fc.constantFrom("", "?q=hello", "?a=1&b=2", "#section", "?x=1#y"),
    leadingSpace: fc.boolean(),
  })
  .map(({ base, trailingSlash, suffix, leadingSpace }) => {
    let p = base;
    if (trailingSlash) p += "/";
    p += suffix;
    if (leadingSpace) p = `  ${p}  `;
    return p;
  });

describe('Property 2: Reserved paths resolve to not-found with reason "reserved"', () => {
  it("resolveRoute returns not-found/reserved for every reserved path, before any other match (with trailing-slash/query/fragment/whitespace variants)", () => {
    fc.assert(
      fc.property(
        iaArb,
        productsArb,
        caseStudiesArb,
        reservedPathArb,
        (ia, products, caseStudies, reservedPath) => {
          const result = resolveRoute(reservedPath, ia, products, caseStudies);

          // Must be not-found with reason "reserved" — never a page, product,
          // or case study, and never the "unknown" reason (which would mean it
          // fell through to a later match instead of being rejected first).
          expect(result.kind).toBe("not-found");
          if (result.kind === "not-found") {
            expect(result.reason).toBe("reserved");
          }
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });
});
