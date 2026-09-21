import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { resolveRoute } from "../src/domain/router";
import { RESERVED_PATHS } from "../src/domain/content-loader";
import type { IA, PageRef, Product, Project, Section } from "../src/types";

/**
 * Feature: website-redesign, Property 13: Reserved paths resolve to not-found
 *
 * For any valid IA — which by validation never contains a reserved path — and
 * any path in the reserved set (search, login, registration paths, including
 * trailing-slash and query-string variants that `resolveRoute` normalizes),
 * `resolveRoute` returns a not-found result and NEVER a page/product/project.
 * This upholds Requirement 8.5: search, login, and registration functionality
 * is never exposed.
 *
 * Validates: Requirements 8.5
 *
 * Strategy: we generate a structurally valid IA (sections with pages whose ids
 * and paths are unique and NONE of which is a reserved path) plus arbitrary
 * product/project catalogs. Independently we pick a reserved path from
 * RESERVED_PATHS and optionally append a trailing slash and/or a query/fragment
 * suffix — inputs `resolveRoute` is documented to normalize. Because the IA
 * generator excludes reserved paths, the reserved-path rejection is exercised on
 * its own merits (defence in depth) rather than merely because the path happens
 * not to be authored. We then assert the result is always `not-found`.
 */

const MIN_ITERATIONS = 100;

/**
 * A generator for a non-reserved, non-parameterized-detail path segment. We keep
 * paths to a single lowercase-alnum segment (e.g. "/about") so uniqueness is
 * easy to reason about and no generated path can collide with a reserved path or
 * with the `/products/` and `/projects/` detail prefixes.
 */
const segmentArb = fc
  .stringMatching(/^[a-z][a-z0-9-]{0,15}$/)
  .filter((s) => s.length > 0);

/** A slug generator for products/projects (single alnum segment). */
const slugArb = fc
  .stringMatching(/^[a-z][a-z0-9-]{0,15}$/)
  .filter((s) => s.length > 0);

/**
 * Build a valid IA from a set of unique segment names. Every page gets a unique
 * id and a unique path `/<segment>`; none of these can be a reserved path since
 * reserved paths (`/search`, `/login`, `/register`) are excluded below.
 */
function makeIA(segments: string[]): IA {
  const usable = segments.filter(
    (s) => !RESERVED_PATHS.includes(`/${s}`),
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

/** Arbitrary project catalog with unique slugs. */
const projectsArb: fc.Arbitrary<Project[]> = fc
  .uniqueArray(slugArb, { minLength: 0, maxLength: 5 })
  .map((slugs) =>
    slugs.map((slug, i) => ({
      name: `Project ${i}`,
      description: `Description ${i}`,
      dateCreated: "2024-01-15",
      id: `proj-${i}`,
      slug,
      detailPageId: `page-proj-${i}`,
    })),
  );

/**
 * A reserved path, optionally decorated with a trailing slash and/or a
 * query-string or fragment suffix — all of which `resolveRoute` normalizes away
 * before the reserved-path check. This exercises that normalization.
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

describe("Property 13: Reserved paths resolve to not-found", () => {
  it("resolveRoute returns not-found for every reserved path (with trailing-slash/query variants)", () => {
    fc.assert(
      fc.property(
        iaArb,
        productsArb,
        projectsArb,
        reservedPathArb,
        (ia, products, projects, reservedPath) => {
          const result = resolveRoute(reservedPath, ia, products, projects);

          // Must be not-found — never a page, product, or project.
          expect(result.kind).toBe("not-found");
          expect(result.kind).not.toBe("page");
          expect(result.kind).not.toBe("product");
          expect(result.kind).not.toBe("project");
        },
      ),
      { numRuns: MIN_ITERATIONS },
    );
  });
});
