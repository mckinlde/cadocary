import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { resolveRoute } from "../src/domain/router";
import { RESERVED_PATHS } from "../src/domain/content-loader";
import type { IA, PageRef, Product, CaseStudy, Section } from "../src/types";

/**
 * Feature: corporate-site-positioning, Property 1: Unavailable, removed, or
 * unknown paths resolve to not-found
 *
 * For any URL path that is neither a reserved path, nor an exact IA page, nor a
 * valid `/products/{slug}` or `/work/{slug}` detail slug — INCLUDING every
 * previously-existing blog path (`/blog`, `/blog/{anything}`) and any
 * unavailable Case_Study/collection target — `resolveRoute` returns a
 * `not-found` result with reason `"unknown"` (rendered as the 404 page, never a
 * blank page). Conversely, a valid `/work/{slug}` for an existing case study
 * resolves to `kind: "caseStudy"`.
 *
 * Validates: Requirements 1.7, 3.9, 4.7, 7.4
 *
 * Strategy: generate a structurally valid, blog-free IA (unique ids/paths, no
 * reserved path) plus arbitrary product and case-study catalogs with unique
 * slugs. Then generate:
 *   - blog-ish paths (`/blog`, `/blog/{segment}`) which the design says are now
 *     unmatched → not-found (Requirement 7.4);
 *   - random single-/multi-segment "unknown" paths that are guaranteed by
 *     construction not to be reserved, not an IA page, and not a valid detail
 *     slug (covering unavailable case-study/collection targets and generally
 *     unknown paths — Requirements 1.7, 3.9, 4.7);
 * and assert each resolves to not-found/unknown. Independently, we assert that
 * for every generated case study, resolving `/work/{slug}` yields that exact
 * case study.
 */

const MIN_ITERATIONS = 100;

/** Single lowercase-alnum path segment (e.g. "about"). */
const segmentArb = fc
  .stringMatching(/^[a-z][a-z0-9-]{0,15}$/)
  .filter((s) => s.length > 0);

/** A slug generator for products/case studies (single alnum segment). */
const slugArb = fc
  .stringMatching(/^[a-z][a-z0-9-]{0,15}$/)
  .filter((s) => s.length > 0);

/**
 * Build a valid, blog-free IA from unique segment names. Every page gets a
 * unique id and a unique path `/<segment>`. We exclude reserved segments, the
 * `blog` segment, and the `products`/`work` prefixes so generated IA pages never
 * collide with the categories under test.
 */
function makeIA(segments: string[]): IA {
  const usable = segments.filter(
    (s) =>
      !RESERVED_PATHS.includes(`/${s}`) &&
      s !== "blog" &&
      s !== "products" &&
      s !== "work",
  );
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

/** Arbitrary valid, blog-free IA with unique single-segment page paths. */
const iaArb: fc.Arbitrary<IA> = fc
  .uniqueArray(segmentArb, { minLength: 0, maxLength: 8 })
  .map(makeIA);

/** Build a product catalog from unique slugs. */
function makeProducts(slugs: string[]): Product[] {
  return slugs.map((slug, i) => ({
    name: `Product ${i}`,
    description: `Description ${i}`,
    id: `prod-${i}`,
    slug,
    order: i,
    detailPageId: `page-prod-${i}`,
  }));
}

/** Build a case-study catalog from unique slugs. */
function makeCaseStudies(slugs: string[]): CaseStudy[] {
  return slugs.map((slug, i) => ({
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
  }));
}

const productsArb: fc.Arbitrary<Product[]> = fc
  .uniqueArray(slugArb, { minLength: 0, maxLength: 5 })
  .map(makeProducts);

const caseStudiesArb: fc.Arbitrary<CaseStudy[]> = fc
  .uniqueArray(slugArb, { minLength: 0, maxLength: 5 })
  .map(makeCaseStudies);

/** Blog-ish path: bare `/blog` or `/blog/{anything}` (single or nested). */
const blogPathArb: fc.Arbitrary<string> = fc.oneof(
  fc.constant("/blog"),
  fc.constant("/blog/"),
  segmentArb.map((s) => `/blog/${s}`),
  fc.tuple(segmentArb, segmentArb).map(([a, b]) => `/blog/${a}/${b}`),
);

/**
 * A random path that is guaranteed not to be reserved. It may or may not match
 * an IA page or a detail slug, so the assertion filters those out using the
 * generated IA/catalogs (see below).
 */
const randomPathArb: fc.Arbitrary<string> = fc.oneof(
  // single unknown segment, e.g. "/foobar"
  segmentArb.map((s) => `/${s}`),
  // nested unknown path, e.g. "/foo/bar" — never a single-segment detail slug
  fc.tuple(segmentArb, segmentArb).map(([a, b]) => `/${a}/${b}`),
  // a `/products/` or `/work/` prefix with a NESTED slug — never a valid detail
  // route (extractSlug rejects slugs containing "/"), so always unknown
  fc.tuple(fc.constantFrom("products", "work"), segmentArb, segmentArb).map(
    ([prefix, a, b]) => `/${prefix}/${a}/${b}`,
  ),
);

/** True when `path` (single trailing-slash tolerated) matches an IA page path. */
function matchesIaPage(ia: IA, path: string): boolean {
  const normalized =
    path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  return ia.sections.some((s) => s.pages.some((p) => p.path === normalized));
}

/** True when `path` is a valid `/products/{slug}` for an existing product. */
function matchesProduct(products: Product[], path: string): boolean {
  if (!path.startsWith("/products/")) return false;
  const slug = path.slice("/products/".length).replace(/\/$/, "");
  return products.some((p) => p.slug === slug);
}

/** True when `path` is a valid `/work/{slug}` for an existing case study. */
function matchesCaseStudy(caseStudies: CaseStudy[], path: string): boolean {
  if (!path.startsWith("/work/")) return false;
  const slug = path.slice("/work/".length).replace(/\/$/, "");
  return caseStudies.some((c) => c.slug === slug);
}

describe("Property 1: Unavailable, removed, or unknown paths resolve to not-found", () => {
  it("blog paths (/blog and /blog/{anything}) always resolve to not-found/unknown", () => {
    fc.assert(
      fc.property(
        iaArb,
        productsArb,
        caseStudiesArb,
        blogPathArb,
        (ia, products, caseStudies, blogPath) => {
          const result = resolveRoute(blogPath, ia, products, caseStudies);
          expect(result.kind).toBe("not-found");
          if (result.kind === "not-found") {
            expect(result.reason).toBe("unknown");
          }
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });

  it("any path that is not reserved, not an IA page, and not a valid detail slug resolves to not-found/unknown", () => {
    fc.assert(
      fc.property(
        iaArb,
        productsArb,
        caseStudiesArb,
        randomPathArb,
        (ia, products, caseStudies, path) => {
          // Skip inputs that legitimately match something — we are asserting
          // ONLY about genuinely unmatched paths here.
          fc.pre(
            !RESERVED_PATHS.includes(path) &&
              !matchesIaPage(ia, path) &&
              !matchesProduct(products, path) &&
              !matchesCaseStudy(caseStudies, path),
          );

          const result = resolveRoute(path, ia, products, caseStudies);
          expect(result.kind).toBe("not-found");
          if (result.kind === "not-found") {
            expect(result.reason).toBe("unknown");
          }
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });

  it("an unavailable /work/{slug} (no matching case study) resolves to not-found/unknown", () => {
    fc.assert(
      fc.property(
        iaArb,
        productsArb,
        caseStudiesArb,
        slugArb,
        (ia, products, caseStudies, slug) => {
          // Only exercise slugs that are NOT present in the catalog.
          fc.pre(!caseStudies.some((c) => c.slug === slug));
          const result = resolveRoute(`/work/${slug}`, ia, products, caseStudies);
          expect(result.kind).toBe("not-found");
          if (result.kind === "not-found") {
            expect(result.reason).toBe("unknown");
          }
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });

  it("a valid /work/{slug} for an existing case study resolves to kind caseStudy", () => {
    fc.assert(
      fc.property(
        iaArb,
        productsArb,
        // At least one case study so there is a valid target to resolve.
        fc.uniqueArray(slugArb, { minLength: 1, maxLength: 5 }).map(makeCaseStudies),
        fc.nat(),
        (ia, products, caseStudies, pick) => {
          const target = caseStudies[pick % caseStudies.length]!;
          const result = resolveRoute(
            `/work/${target.slug}`,
            ia,
            products,
            caseStudies,
          );
          expect(result.kind).toBe("caseStudy");
          if (result.kind === "caseStudy") {
            expect(result.caseStudy.slug).toBe(target.slug);
            expect(result.caseStudy.id).toBe(target.id);
          }
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });
});
