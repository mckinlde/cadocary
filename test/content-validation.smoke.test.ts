/**
 * =============================================================================
 * Build-time content validation smoke check
 * =============================================================================
 *
 * This smoke test is the "build gate" for authored content (design.md →
 * Testing Strategy → Integration / Smoke: "A build-time validation smoke check
 * that all shipped JSON content passes its schemas"). It imports the ACTUAL
 * shipped JSON documents from `src/content/` and runs them through the real
 * content loader — the same hand-written draft 2020-12 validator plus the
 * cross-document IA integrity checks used at runtime.
 *
 * Because `loadContent` fails loud in non-production environments (it throws a
 * `ContentLoadError`), and because we additionally assert `ok === true`, ANY
 * schema violation or IA integrity violation (duplicate id/path, page in no
 * section, dangling defaultSectionId, or a reserved path leaking into the IA)
 * fails this test and therefore the build/test run. This is exactly the
 * fail-on-any-violation behavior task 10.1 asks for.
 *
 * It also confirms the seed content lines up: every product/project detail page
 * referenced by `detailPageId` exists in the IA, and detail paths match the
 * `/products/{slug}` and `/projects/{slug}` convention, so nav/footer/routes
 * stay in sync with products.json / projects.json.
 *
 * Traceability: Requirements 2.1 (pages organized into top-level sections that
 * map to nav items), 2.3 (products presented in a Products section), 2.4
 * (projects presented in a Projects section).
 */
import { describe, it, expect } from "vitest";

import {
  loadContent,
  type ContentSource,
} from "../src/domain/content-loader";
import type { Product, Project } from "../src/types";

// The real, shipped content documents. Imported directly so this test validates
// exactly what the site will build with.
import ia from "../src/content/ia.json";
import products from "../src/content/products.json";
import projects from "../src/content/projects.json";
import slideDeck from "../src/content/slides.json";
import mission from "../src/content/mission.json";

const source: ContentSource = {
  ia,
  products,
  projects,
  slideDeck,
  mission,
};

describe("shipped content validation smoke check", () => {
  it("passes schema validation and IA integrity for all shipped JSON", () => {
    // `loadContent` throws in non-production (fail-loud). Force `failLoud: false`
    // so a failure surfaces as a readable assertion here rather than an
    // exception, but assert `ok === true` so any violation still fails the run.
    const result = loadContent(source, { failLoud: false });

    if (!result.ok) {
      // Surface every issue so an author sees precisely what to fix.
      const detail = result.error.issues
        .map((issue) => `  - ${issue.path}: ${issue.message}`)
        .join("\n");
      throw new Error(
        `Shipped content failed validation [${result.error.source}]:\n${detail}`,
      );
    }

    expect(result.ok).toBe(true);
  });

  it("also fails loud (throws) when loaded in development mode", () => {
    // Sanity check that the shipped content survives the default fail-loud path
    // used during `astro build` / local development.
    expect(() => loadContent(source, { failLoud: true })).not.toThrow();
  });

  it("keeps product/project detail pages in sync with the IA", () => {
    const result = loadContent(source, { failLoud: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { ia: loadedIa, products: loadedProducts, projects: loadedProjects } =
      result.value;

    // Every page id/path declared in the IA, for cross-referencing.
    const pageIds = new Set<string>();
    const pagePaths = new Map<string, string>(); // id -> path
    for (const section of loadedIa.sections) {
      for (const page of section.pages) {
        pageIds.add(page.id);
        pagePaths.set(page.id, page.path);
      }
    }

    // Products (Req 2.3): each detail page must exist in the IA. Non-external
    // products additionally follow the /products/{slug} detail-path convention.
    // An "external" product (whose `url` points outside /products/, e.g. the
    // Highlighter app at /highlighter/) is surfaced via a link-out card rather
    // than a generated detail page, so its IA page path is its external url.
    for (const product of loadedProducts as Product[]) {
      expect(pageIds.has(product.detailPageId)).toBe(true);
      const isExternal =
        typeof product.url === "string" && !product.url.startsWith("/products/");
      if (isExternal) {
        expect(pagePaths.get(product.detailPageId)).toBe(product.url);
      } else {
        expect(pagePaths.get(product.detailPageId)).toBe(
          `/products/${product.slug}`,
        );
      }
    }

    // Projects (Req 2.4): each detail page must exist in the IA and its path
    // must follow the /projects/{slug} convention.
    for (const project of loadedProjects as Project[]) {
      expect(pageIds.has(project.detailPageId)).toBe(true);
      expect(pagePaths.get(project.detailPageId)).toBe(
        `/projects/${project.slug}`,
      );
    }

    // Req 2.1: there is a dedicated Products section and a Projects section.
    const sectionIds = new Set(loadedIa.sections.map((s) => s.id));
    expect(sectionIds.has("products")).toBe(true);
    expect(sectionIds.has("projects")).toBe(true);
  });
});
