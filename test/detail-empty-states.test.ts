/**
 * =============================================================================
 * Example-based unit tests — detail pages, empty states, and section placement
 * =============================================================================
 *
 * Task 13.4 (example/interaction tests, NOT property-based). These cover the
 * concrete detail-page and empty-state behaviors called out in design.md →
 * Testing Strategy → Example-Based Unit & Interaction Tests:
 *
 *   - Selection navigates                    (5.3, 6.3)
 *   - Detail renders existing content        (5.4, 6.4)
 *   - Unavailable detail stays put + message (5.5, 6.5)
 *   - Empty-state messages                   (5.6, 6.6)
 *   - Products under Products section        (2.3)
 *   - Projects under Projects section        (2.4)
 *
 * SCOPE NOTE (what is covered here vs. deferred to e2e):
 * Rendering the actual `.astro` detail pages and components in Vitest is heavy
 * and brittle, so these tests exercise the SAME testable logic the pages/
 * components are built on, using the REAL shipped seed content (loaded through
 * `loadContent`, so this doubles as an integration check):
 *
 *   - "Selection navigates" is verified at the routing layer: `resolveRoute`
 *     for a card's `/products/{slug}` (or `/projects/{slug}`) href resolves to
 *     the matching product/project. The actual anchor click + in-browser
 *     navigation timing (the "within 2s" wording of 5.3/6.3) is a UI concern
 *     deferred to e2e.
 *   - "Detail renders existing content" / "unavailable detail stays put" are
 *     verified via the exact `hasDetail` predicate the detail pages use
 *     (`Array.isArray(body) && body.length > 0`): true selects the content
 *     branch, false selects the message branch. The rendered DOM / message copy
 *     is a UI concern deferred to e2e.
 *   - "Empty-state messages" are verified via `orderProducts([])` /
 *     `orderProjects([])` returning `[]` — the exact condition the components
 *     switch on to render the empty-state message. The message text/markup is
 *     deferred to e2e.
 *   - "Products/Projects under their section" is verified against the real IA:
 *     each product/project `detailPageId` resolves to a page inside the
 *     `products` / `projects` section respectively.
 */
import { describe, it, expect } from "vitest";

import {
  loadContent,
  type ContentSource,
  type ContentBundle,
} from "../src/domain/content-loader";
import { orderProducts, orderProjects } from "../src/domain/ordering";
import { resolveRoute } from "../src/domain/router";
import type { ContentBlock, IA, Product, Project } from "../src/types";

// Real, shipped seed content — loading it here makes these tests double as an
// integration check that the seed content is valid and internally consistent.
import ia from "../src/content/ia.json";
import products from "../src/content/products.json";
import projects from "../src/content/projects.json";
import slideDeck from "../src/content/slides.json";
import mission from "../src/content/mission.json";

const source: ContentSource = { ia, products, projects, slideDeck, mission };

/** Load the real seed content once; fail the suite loudly if it is invalid. */
function loadBundle(): ContentBundle {
  const result = loadContent(source, { failLoud: false });
  if (!result.ok) {
    const detail = result.error.issues
      .map((issue) => `  - ${issue.path}: ${issue.message}`)
      .join("\n");
    throw new Error(`Seed content failed to load [${result.error.source}]:\n${detail}`);
  }
  return result.value;
}

/**
 * Mirror of the detail pages' availability predicate:
 *   src/pages/products/[slug].astro → `Array.isArray(product.body) && product.body.length > 0`
 *   src/pages/projects/[slug].astro → `(project.body ?? []).length > 0`
 * true → render existing content; false → stay put and show the message.
 */
function hasDetail(body: ContentBlock[] | undefined): boolean {
  return Array.isArray(body) && body.length > 0;
}

/** Find the section that owns the page with the given id, if any. */
function findOwningSectionId(loadedIa: IA, pageId: string): string | undefined {
  for (const section of loadedIa.sections) {
    if (section.pages.some((page) => page.id === pageId)) {
      return section.id;
    }
  }
  return undefined;
}

/** Look up a page's path by id across the whole IA. */
function pathForPageId(loadedIa: IA, pageId: string): string | undefined {
  for (const section of loadedIa.sections) {
    const page = section.pages.find((p) => p.id === pageId);
    if (page) return page.path;
  }
  return undefined;
}

describe("detail & empty-state behaviors (task 13.4)", () => {
  const bundle = loadBundle();
  const { ia: loadedIa, products: loadedProducts, projects: loadedProjects } =
    bundle;

  /* ---------------------------------------------------------------------------
   * Selection navigates (5.3, 6.3)
   * A product/project card links to `/products/{slug}` (or `/projects/{slug}`).
   * Resolving that href routes to a real destination for the item — never
   * not-found. Per resolveRoute's contract, a detail page may be reached
   * "either from a dedicated IA entry or from a parameterized route", so the
   * seed content (which declares detail pages as explicit IA PageRefs) resolves
   * to a `page` whose path is the detail path. A product/project WITHOUT a
   * dedicated IA entry falls through to the parameterized `product`/`project`
   * route. Both are valid "selection navigates" outcomes; a `not-found` is not.
   * ------------------------------------------------------------------------ */
  describe("selection navigates to the detail page (5.3, 6.3)", () => {
    it("resolves each product's card href to that product's detail page (5.3)", () => {
      expect(loadedProducts.length).toBeGreaterThan(0);
      for (const product of loadedProducts) {
        const href = `/products/${product.slug}`;
        const result = resolveRoute(href, loadedIa, loadedProducts, loadedProjects);
        // Must navigate somewhere real (not a broken/404 result).
        expect(result.kind).not.toBe("not-found");
        if (result.kind === "product") {
          expect(result.product.id).toBe(product.id);
        } else if (result.kind === "page") {
          // Reached via the dedicated IA entry: its path is the detail path.
          expect(result.page.path).toBe(href);
        } else {
          throw new Error(`unexpected route kind "${result.kind}" for ${href}`);
        }
      }
    });

    it("resolves each project's card href to that project's detail page (6.3)", () => {
      expect(loadedProjects.length).toBeGreaterThan(0);
      for (const project of loadedProjects) {
        const href = `/projects/${project.slug}`;
        const result = resolveRoute(href, loadedIa, loadedProducts, loadedProjects);
        expect(result.kind).not.toBe("not-found");
        if (result.kind === "project") {
          expect(result.project.id).toBe(project.id);
        } else if (result.kind === "page") {
          expect(result.page.path).toBe(href);
        } else {
          throw new Error(`unexpected route kind "${result.kind}" for ${href}`);
        }
      }
    });

    it("parameterized detail routes resolve when no dedicated IA entry exists", () => {
      // Verify the parameterized `/products/:slug` and `/projects/:slug` routes
      // work for a slug that is NOT declared as an explicit IA page — the
      // fallback path that backs detail navigation for undeclared items.
      const iaWithoutDetailPages: IA = {
        ...loadedIa,
        sections: loadedIa.sections.map((s) => ({
          ...s,
          pages: s.pages.filter(
            (p) =>
              !p.path.startsWith("/products/") &&
              !p.path.startsWith("/projects/"),
          ),
        })),
      };

      const product = loadedProducts[0]!;
      const prodResult = resolveRoute(
        `/products/${product.slug}`,
        iaWithoutDetailPages,
        loadedProducts,
        loadedProjects,
      );
      expect(prodResult.kind).toBe("product");
      if (prodResult.kind === "product") {
        expect(prodResult.product.id).toBe(product.id);
      }

      const project = loadedProjects[0]!;
      const projResult = resolveRoute(
        `/projects/${project.slug}`,
        iaWithoutDetailPages,
        loadedProducts,
        loadedProjects,
      );
      expect(projResult.kind).toBe("project");
      if (projResult.kind === "project") {
        expect(projResult.project.id).toBe(project.id);
      }
    });
  });

  /* ---------------------------------------------------------------------------
   * Detail renders existing content (5.4, 6.4)
   * The seed products/projects have body ContentBlocks, so the detail page takes
   * the "render content" branch (hasDetail === true).
   * ------------------------------------------------------------------------ */
  describe("detail page renders existing content (5.4, 6.4)", () => {
    it("every seed product with a generated detail page has body content and takes the content branch (5.4)", () => {
      // External products (whose `url` points outside /products/, e.g. the
      // Highlighter app at /highlighter/) are surfaced via a link-out card and
      // have no generated detail page, so they need no body content.
      const detailProducts = loadedProducts.filter(
        (p) => typeof p.url !== "string" || p.url.startsWith("/products/"),
      );
      expect(detailProducts.length).toBeGreaterThan(0);
      for (const product of detailProducts) {
        expect(Array.isArray(product.body)).toBe(true);
        expect((product.body ?? []).length).toBeGreaterThan(0);
        expect(hasDetail(product.body)).toBe(true);
      }
    });

    it("every seed project has body content and takes the content branch (6.4)", () => {
      for (const project of loadedProjects) {
        expect(Array.isArray(project.body)).toBe(true);
        expect((project.body ?? []).length).toBeGreaterThan(0);
        expect(hasDetail(project.body)).toBe(true);
      }
    });
  });

  /* ---------------------------------------------------------------------------
   * Unavailable detail stays put with a message (5.5, 6.5)
   * For an item whose body is empty/missing, the predicate is false — i.e. the
   * branch that keeps the page and shows the "cannot be displayed" message.
   * ------------------------------------------------------------------------ */
  describe("unavailable detail takes the message branch (5.5, 6.5)", () => {
    it("hasDetail is false for a product with an empty body (5.5)", () => {
      const template = loadedProducts[0]!;
      const emptyBodyProduct: Product = { ...template, body: [] };
      expect(hasDetail(emptyBodyProduct.body)).toBe(false);
    });

    it("hasDetail is false for a product with a missing body (5.5)", () => {
      const template = loadedProducts[0]!;
      const missingBodyProduct: Product = { ...template };
      delete missingBodyProduct.body;
      expect(hasDetail(missingBodyProduct.body)).toBe(false);
    });

    it("hasDetail is false for a project with an empty body (6.5)", () => {
      const template = loadedProjects[0]!;
      const emptyBodyProject: Project = { ...template, body: [] };
      expect(hasDetail(emptyBodyProject.body)).toBe(false);
    });

    it("hasDetail is false for a project with a missing body (6.5)", () => {
      const template = loadedProjects[0]!;
      const missingBodyProject: Project = { ...template };
      delete missingBodyProject.body;
      expect(hasDetail(missingBodyProject.body)).toBe(false);
    });
  });

  /* ---------------------------------------------------------------------------
   * Empty-state messages (5.6, 6.6)
   * The catalog/showcase render the empty message when the ordered list is
   * empty. orderProducts([]) / orderProjects([]) return [] — the exact
   * condition the components switch on.
   * ------------------------------------------------------------------------ */
  describe("empty catalog/showcase yields the empty-state branch (5.6, 6.6)", () => {
    it("orderProducts([]) returns [] so the products empty state renders (5.6)", () => {
      const ordered = orderProducts([]);
      expect(ordered).toEqual([]);
      expect(ordered.length === 0).toBe(true);
    });

    it("orderProjects([]) returns [] so the projects empty state renders (6.6)", () => {
      const ordered = orderProjects([]);
      expect(ordered).toEqual([]);
      expect(ordered.length === 0).toBe(true);
    });

    it("a non-empty catalog/showcase does NOT take the empty-state branch", () => {
      // Sanity: with seed content present, the ordered lists are non-empty, so
      // the components render cards rather than the empty message.
      expect(orderProducts(loadedProducts).length).toBeGreaterThan(0);
      expect(orderProjects(loadedProjects).length).toBeGreaterThan(0);
    });
  });

  /* ---------------------------------------------------------------------------
   * Section placement (2.3, 2.4)
   * Products are surfaced in the Products section and projects in the Projects
   * section: each item's detailPageId resolves to a page inside that section.
   * ------------------------------------------------------------------------ */
  describe("products/projects live under their dedicated section (2.3, 2.4)", () => {
    it("there is a dedicated Products section and Projects section", () => {
      const sectionIds = new Set(loadedIa.sections.map((s) => s.id));
      expect(sectionIds.has("products")).toBe(true);
      expect(sectionIds.has("projects")).toBe(true);
    });

    it("every product's detail page belongs to the Products section (2.3)", () => {
      for (const product of loadedProducts) {
        const owningSection = findOwningSectionId(loadedIa, product.detailPageId);
        expect(owningSection).toBe("products");
        // Non-external products follow the /products/{slug} convention; external
        // products (link-out cards, e.g. Highlighter) use their external url.
        const isExternal =
          typeof product.url === "string" && !product.url.startsWith("/products/");
        expect(pathForPageId(loadedIa, product.detailPageId)).toBe(
          isExternal ? product.url : `/products/${product.slug}`,
        );
      }
    });

    it("every project's detail page belongs to the Projects section (2.4)", () => {
      for (const project of loadedProjects) {
        const owningSection = findOwningSectionId(loadedIa, project.detailPageId);
        expect(owningSection).toBe("projects");
        expect(pathForPageId(loadedIa, project.detailPageId)).toBe(
          `/projects/${project.slug}`,
        );
      }
    });
  });
});
