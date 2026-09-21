import { describe, expect, test } from "vitest";
import fc from "fast-check";

import {
  toCreativeWorkJsonLd,
  toProductJsonLd,
  toSiteNavigationJsonLd,
} from "../src/domain/json-ld";
import type {
  ContentBlock,
  NavItem,
  NavLink,
  NavModel,
  Product,
  Project,
} from "../src/types";

/**
 * Feature: website-redesign, Property 14: JSON-LD derivation is well-formed and reflects authored content
 *
 * Validates: Requirements 5.2, 6.2, 6.1
 *
 * For any authored product or project, the emitted JSON-LD is well-formed — its
 * `@context` is "https://schema.org" and its `@type` is "Product" for products
 * and "CreativeWork" for projects — and it reflects the authored content: every
 * present Schema.org-aligned field (`name`, `description`, and any `image`/`url`,
 * plus `dateCreated` for projects) appears in the output unchanged, while
 * internal-only fields (`id`, `slug`, `order`, `detailPageId`, `body`) never
 * appear. Likewise, for any navigation model, the emitted structured data is an
 * `ItemList` of `SiteNavigationElement` entries corresponding one-to-one (with
 * `name` and `url`) to the model's nav links.
 *
 * Strategy: generate products and projects that vary the presence of the
 * optional `image`/`url` fields (present / absent, independently) while always
 * carrying the internal bookkeeping fields, so we exercise both "optional field
 * emitted" and "optional field omitted" paths and confirm internal fields never
 * leak. For navigation, generate a NavModel mixing `link` and `menu` items so
 * the flattened nav-link order is non-trivial, then assert the emitted ItemList
 * mirrors it one-to-one.
 */

const MIN_ITERATIONS = 100;

/** Internal bookkeeping fields that must NEVER appear in emitted JSON-LD. */
const INTERNAL_FIELDS = ["id", "slug", "order", "detailPageId", "body"] as const;

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

/** Arbitrary Project. Adds required `dateCreated`; `image`/`url` optional. */
const projectArb: fc.Arbitrary<Project> = fc.record({
  name: fc.string(),
  description: fc.string(),
  image: fc.option(fc.webUrl(), { nil: undefined }),
  url: fc.option(fc.webUrl(), { nil: undefined }),
  dateCreated: fc
    .date({ min: new Date("2000-01-01"), max: new Date("2035-01-01") })
    .map((d) => d.toISOString()),
  id: fc.string({ minLength: 1 }),
  slug: fc.string({ minLength: 1 }),
  detailPageId: fc.string({ minLength: 1 }),
  body: fc.option(fc.array(contentBlockArb, { maxLength: 3 }), {
    nil: undefined,
  }),
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

  test("project JSON-LD is well-formed, preserves Schema.org fields (incl. dateCreated), and hides internal fields", () => {
    fc.assert(
      fc.property(projectArb, (project) => {
        const jsonLd = toCreativeWorkJsonLd(project);

        // Well-formed: fixed context and creative-work type.
        expect(jsonLd["@context"]).toBe("https://schema.org");
        expect(jsonLd["@type"]).toBe("CreativeWork");

        // Required Schema.org-aligned fields preserved unchanged.
        expect(jsonLd.name).toBe(project.name);
        expect(jsonLd.description).toBe(project.description);
        expect(jsonLd.dateCreated).toBe(project.dateCreated);

        // Optional image/url: present unchanged iff authored, else absent key.
        if (project.image === undefined) {
          expect("image" in jsonLd).toBe(false);
        } else {
          expect(jsonLd.image).toBe(project.image);
        }
        if (project.url === undefined) {
          expect("url" in jsonLd).toBe(false);
        } else {
          expect(jsonLd.url).toBe(project.url);
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
