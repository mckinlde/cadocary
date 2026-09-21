import { describe, expect, test } from "vitest";
import fc from "fast-check";

import {
  toCaseStudyJsonLd,
  toProductJsonLd,
  toServiceJsonLd,
  toSiteNavigationJsonLd,
} from "../src/domain/json-ld";
import type {
  CaseStudy,
  CaseStudySection,
  ContentBlock,
  NavItem,
  NavLink,
  NavModel,
  Product,
  ProofPoint,
  ServiceOffering,
} from "../src/types";

/**
 * Feature: website-redesign, Property 14: JSON-LD derivation is well-formed and reflects authored content
 *
 * Validates: Requirements 5.2, 6.2, 6.1
 *
 * For any authored product, the emitted JSON-LD is well-formed — its `@context`
 * is "https://schema.org" and its `@type` is "Product" — and it reflects the
 * authored content: every present Schema.org-aligned field (`name`,
 * `description`, and any `image`/`url`) appears in the output unchanged, while
 * internal-only fields (`id`, `slug`, `order`, `detailPageId`, `body`) never
 * appear. Likewise, for any navigation model, the emitted structured data is an
 * `ItemList` of `SiteNavigationElement` entries corresponding one-to-one (with
 * `name` and `url`) to the model's nav links.
 *
 * ---------------------------------------------------------------------------
 * Feature: corporate-site-positioning, Property 21: JSON-LD derivation emits
 * only public Schema.org fields
 *
 * Validates: Requirements 4.1, 4.3
 *
 * The projects → caseStudies migration replaced the deprecated
 * `toCreativeWorkJsonLd(project)` derivation with two new derivations tested
 * below: `toCaseStudyJsonLd(caseStudy)` (a Schema.org `CreativeWork`) and
 * `toServiceJsonLd(offering)` (a Schema.org `Service`). Both emit ONLY public
 * Schema.org fields and NEVER internal bookkeeping.
 * ---------------------------------------------------------------------------
 *
 * Strategy: generate products that vary the presence of the optional
 * `image`/`url` fields (present / absent, independently) while always carrying
 * the internal bookkeeping fields, so we exercise both "optional field emitted"
 * and "optional field omitted" paths and confirm internal fields never leak. For
 * navigation, generate a NavModel mixing `link` and `menu` items so the
 * flattened nav-link order is non-trivial, then assert the emitted ItemList
 * mirrors it one-to-one. For case studies and services, generate full entities
 * carrying every internal field and assert none leak into the emitted JSON-LD.
 */

const MIN_ITERATIONS = 100;

/** Internal bookkeeping fields that must NEVER appear in emitted product JSON-LD. */
const INTERNAL_FIELDS = ["id", "slug", "order", "detailPageId", "body"] as const;

/**
 * Internal / case-study-specific fields that must NEVER appear in emitted
 * Case_Study JSON-LD (Property 21). Also includes `dateCreated`, which case
 * studies intentionally do NOT carry.
 */
const CASE_STUDY_INTERNAL_FIELDS = [
  "id",
  "slug",
  "order",
  "detailPageId",
  "engagementRole",
  "deliverable",
  "sections",
  "proofPoints",
  "clientName",
  "clientSiteUrl",
  "dateCreated",
] as const;

/** Internal fields that must NEVER appear in emitted Service JSON-LD (Property 21). */
const SERVICE_INTERNAL_FIELDS = ["id", "order", "caseStudyRef"] as const;

/** A small arbitrary content body, used only to populate the internal `body`. */
const contentBlockArb: fc.Arbitrary<ContentBlock> = fc.oneof(
  fc.record({ type: fc.constant<"paragraph">("paragraph"), text: fc.string() }),
  fc.record({
    type: fc.constant<"heading">("heading"),
    level: fc.constantFrom<2 | 3 | 4>(2, 3, 4),
    text: fc.string(),
  }),
);

/**
 * Arbitrary Product. `image` and `url` are independently present or absent so
 * we cover all four presence combinations across runs.
 */
const productArb: fc.Arbitrary<Product> = fc.record({
  name: fc.string(),
  description: fc.string(),
  image: fc.option(fc.webUrl(), { nil: undefined }),
  url: fc.option(fc.webUrl(), { nil: undefined }),
  id: fc.string({ minLength: 1 }),
  slug: fc.string({ minLength: 1 }),
  order: fc.integer(),
  detailPageId: fc.string({ minLength: 1 }),
  body: fc.option(fc.array(contentBlockArb, { maxLength: 3 }), {
    nil: undefined,
  }),
});

/** Arbitrary one-of-four case-study section. */
const caseStudySectionArb: fc.Arbitrary<CaseStudySection> = fc.record({
  kind: fc.constantFrom<CaseStudySection["kind"]>(
    "problem",
    "approach",
    "whatWasBuilt",
    "outcome",
  ),
  body: fc.array(contentBlockArb, { minLength: 1, maxLength: 3 }),
});

/** Arbitrary proof point (client- or cadocary-attributed). */
const proofPointArb: fc.Arbitrary<ProofPoint> = fc.record({
  label: fc.string({ minLength: 1 }),
  detail: fc.option(fc.string(), { nil: undefined }),
  attribution: fc.constantFrom<ProofPoint["attribution"]>("client", "cadocary"),
});

/**
 * Arbitrary CaseStudy carrying every internal/case-study-specific field, with
 * `image`/`url` independently present or absent. The image is the authored
 * `{ src, alt }` object; the derivation emits only its `src`.
 */
const caseStudyArb: fc.Arbitrary<CaseStudy> = fc.record({
  name: fc.string(),
  description: fc.string(),
  image: fc.option(
    fc.record({ src: fc.webUrl(), alt: fc.string({ minLength: 1, maxLength: 125 }) }),
    { nil: undefined },
  ),
  url: fc.option(fc.webUrl(), { nil: undefined }),
  clientName: fc.string({ minLength: 1 }),
  clientSiteUrl: fc.webUrl(),
  engagementRole: fc.string({ minLength: 1 }),
  deliverable: fc.string({ minLength: 1 }),
  sections: fc.array(caseStudySectionArb, { minLength: 1, maxLength: 4 }),
  proofPoints: fc.option(fc.array(proofPointArb, { maxLength: 3 }), {
    nil: undefined,
  }),
  id: fc.string({ minLength: 1 }),
  slug: fc.string({ minLength: 1 }),
  order: fc.integer(),
  detailPageId: fc.string({ minLength: 1 }),
});

/** Arbitrary ServiceOffering carrying internal fields and optional caseStudyRef. */
const serviceOfferingArb: fc.Arbitrary<ServiceOffering> = fc.record({
  name: fc.string(),
  description: fc.string(),
  caseStudyRef: fc.option(fc.string(), { nil: undefined }),
  id: fc.string({ minLength: 1 }),
  order: fc.integer(),
});

/** Arbitrary NavLink for use as a menu child. */
const navLinkArb: fc.Arbitrary<NavLink> = fc.record({
  label: fc.string(),
  pageId: fc.string({ minLength: 1 }),
  path: fc.string({ minLength: 1 }),
});

/** Arbitrary NavItem: either a direct link or a dropdown menu of links. */
const navItemArb: fc.Arbitrary<NavItem> = fc.oneof(
  fc.record({
    kind: fc.constant<"link">("link"),
    label: fc.string(),
    pageId: fc.string({ minLength: 1 }),
    path: fc.string({ minLength: 1 }),
  }),
  fc.record({
    kind: fc.constant<"menu">("menu"),
    label: fc.string(),
    sectionId: fc.string({ minLength: 1 }),
    children: fc.array(navLinkArb, { minLength: 0, maxLength: 4 }),
  }),
);

/** Arbitrary NavModel: 0..6 top-level items mixing links and menus. */
const navModelArb: fc.Arbitrary<NavModel> = fc.record({
  items: fc.array(navItemArb, { minLength: 0, maxLength: 6 }),
});

/**
 * Flatten a NavModel into the sequence of (name, url) pairs that the emitted
 * ItemList must mirror: each `link` contributes its own (label, path), and each
 * `menu` contributes one pair per child, in child order.
 */
function expectedNavPairs(nav: NavModel): { name: string; url: string }[] {
  const pairs: { name: string; url: string }[] = [];
  for (const item of nav.items) {
    if (item.kind === "link") {
      pairs.push({ name: item.label, url: item.path });
    } else {
      for (const child of item.children) {
        pairs.push({ name: child.label, url: child.path });
      }
    }
  }
  return pairs;
}

describe("Property 14: JSON-LD derivation is well-formed and reflects authored content", () => {
  test("product JSON-LD is well-formed, preserves Schema.org fields, and hides internal fields", () => {
    fc.assert(
      fc.property(productArb, (product) => {
        const jsonLd = toProductJsonLd(product);

        // Well-formed: fixed context and product type.
        expect(jsonLd["@context"]).toBe("https://schema.org");
        expect(jsonLd["@type"]).toBe("Product");

        // Required Schema.org-aligned fields preserved unchanged.
        expect(jsonLd.name).toBe(product.name);
        expect(jsonLd.description).toBe(product.description);

        // Optional image/url: present unchanged iff authored, else absent key.
        if (product.image === undefined) {
          expect("image" in jsonLd).toBe(false);
        } else {
          expect(jsonLd.image).toBe(product.image);
        }
        if (product.url === undefined) {
          expect("url" in jsonLd).toBe(false);
        } else {
          expect(jsonLd.url).toBe(product.url);
        }

        // Internal-only fields never appear as keys.
        for (const field of INTERNAL_FIELDS) {
          expect(field in jsonLd).toBe(false);
        }
      }),
      { numRuns: MIN_ITERATIONS },
    );
  });

  test("navigation JSON-LD is an ItemList of SiteNavigationElements matching nav links one-to-one", () => {
    fc.assert(
      fc.property(navModelArb, (nav) => {
        const jsonLd = toSiteNavigationJsonLd(nav);

        // Well-formed: fixed context and ItemList type.
        expect(jsonLd["@context"]).toBe("https://schema.org");
        expect(jsonLd["@type"]).toBe("ItemList");

        const elements = jsonLd.itemListElement as Array<Record<string, unknown>>;
        const expected = expectedNavPairs(nav);

        // One-to-one correspondence, in order.
        expect(elements).toHaveLength(expected.length);

        for (let i = 0; i < expected.length; i++) {
          const el = elements[i];
          expect(el["@context"]).toBe("https://schema.org");
          expect(el["@type"]).toBe("SiteNavigationElement");
          expect(el.name).toBe(expected[i].name);
          expect(el.url).toBe(expected[i].url);
        }
      }),
      { numRuns: MIN_ITERATIONS },
    );
  });
});

describe("Property 21: JSON-LD derivation emits only public Schema.org fields", () => {
  test("case-study JSON-LD is a CreativeWork with only public fields, never internal bookkeeping", () => {
    fc.assert(
      fc.property(caseStudyArb, (caseStudy) => {
        const jsonLd = toCaseStudyJsonLd(caseStudy);

        // Well-formed: fixed context and CreativeWork type.
        expect(jsonLd["@context"]).toBe("https://schema.org");
        expect(jsonLd["@type"]).toBe("CreativeWork");

        // Public fields preserved unchanged.
        expect(jsonLd.name).toBe(caseStudy.name);
        expect(jsonLd.description).toBe(caseStudy.description);

        // Optional image emits ONLY the src string; omitted when absent.
        if (caseStudy.image === undefined) {
          expect("image" in jsonLd).toBe(false);
        } else {
          expect(jsonLd.image).toBe(caseStudy.image.src);
        }

        // Optional url: present unchanged iff authored, else absent key.
        if (caseStudy.url === undefined) {
          expect("url" in jsonLd).toBe(false);
        } else {
          expect(jsonLd.url).toBe(caseStudy.url);
        }

        // Only the public Schema.org keys may appear.
        const allowed = new Set([
          "@context",
          "@type",
          "name",
          "description",
          "image",
          "url",
        ]);
        for (const key of Object.keys(jsonLd)) {
          expect(allowed.has(key)).toBe(true);
        }

        // Internal / case-study-specific fields never appear.
        for (const field of CASE_STUDY_INTERNAL_FIELDS) {
          expect(field in jsonLd).toBe(false);
        }
      }),
      { numRuns: MIN_ITERATIONS },
    );
  });

  test("service JSON-LD is a Service with name + description only, never internal fields", () => {
    fc.assert(
      fc.property(serviceOfferingArb, (offering) => {
        const jsonLd = toServiceJsonLd(offering);

        // Well-formed: fixed context and Service type.
        expect(jsonLd["@context"]).toBe("https://schema.org");
        expect(jsonLd["@type"]).toBe("Service");

        // Public fields preserved unchanged.
        expect(jsonLd.name).toBe(offering.name);
        expect(jsonLd.description).toBe(offering.description);

        // Services emit exactly @context, @type, name, description — nothing else.
        const allowed = new Set(["@context", "@type", "name", "description"]);
        for (const key of Object.keys(jsonLd)) {
          expect(allowed.has(key)).toBe(true);
        }

        // Internal fields (incl. the app-only caseStudyRef) never appear.
        for (const field of SERVICE_INTERNAL_FIELDS) {
          expect(field in jsonLd).toBe(false);
        }
      }),
      { numRuns: MIN_ITERATIONS },
    );
  });
});
