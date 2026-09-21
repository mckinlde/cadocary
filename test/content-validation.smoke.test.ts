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
 * fails this test and therefore the build/test run.
 *
 * It also confirms the seed content lines up with the corporate-site-positioning
 * content model: the renamed `caseStudies` document (formerly `projects`) and
 * the new `services` document validate, every case-study/product detail page
 * referenced by `detailPageId` exists in the IA, and detail paths match the
 * `/work/{slug}` and `/products/{slug}` conventions, so nav/footer/routes stay
 * in sync with caseStudies.json / products.json. Finally it asserts every case
 * study carries the single confirmed consultancy `engagementRole` constant.
 *
 * Traceability: Requirements 4.1 (each client engagement presented as a case
 * study), 3.1 (Services page presents Service_Offering entries), 7.5 (site
 * builds successfully after blog removal — validated content is a build gate),
 * 7.7 (IA contains zero blog sections / blog page entries).
 */
import { describe, it, expect } from "vitest";

import {
  loadContent,
  type ContentSource,
} from "../src/domain/content-loader";
import type { Product, CaseStudy } from "../src/types";

// The real, shipped content documents. Imported directly so this test validates
// exactly what the site will build with.
import ia from "../src/content/ia.json";
import products from "../src/content/products.json";
import caseStudies from "../src/content/caseStudies.json";
import services from "../src/content/services.json";
import slideDeck from "../src/content/slides.json";
import mission from "../src/content/mission.json";

const source: ContentSource = {
  ia,
  products,
  caseStudies,
  services,
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

  it("validates the renamed caseStudies document and the new services document", () => {
    // The corporate-site-positioning model replaces `projects.json` with
    // `caseStudies.json` and adds `services.json`. A successful load proves both
    // documents pass their schemas via the existing loader/validate path
    // (Requirements 4.1, 3.1).
    const result = loadContent(source, { failLoud: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { caseStudies: loadedCaseStudies, services: loadedServices } =
      result.value;

    // Req 4.1: each existing client engagement is present as a case study.
    const caseStudyIds = new Set(loadedCaseStudies.map((cs) => cs.id));
    expect(caseStudyIds.has("spendlogic")).toBe(true);
    expect(caseStudyIds.has("hotels4truckers")).toBe(true);
    expect(caseStudyIds.has("purlpal")).toBe(true);

    // Req 3.1: the Services page presents at least one Service_Offering.
    expect(loadedServices.offerings.length).toBeGreaterThanOrEqual(1);
    expect(loadedServices.offerings.length).toBeLessThanOrEqual(20);
  });

  it("keeps product and case-study detail pages in sync with the IA", () => {
    const result = loadContent(source, { failLoud: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const {
      ia: loadedIa,
      products: loadedProducts,
      caseStudies: loadedCaseStudies,
    } = result.value;

    // Every page id/path declared in the IA, for cross-referencing.
    const pageIds = new Set<string>();
    const pagePaths = new Map<string, string>(); // id -> path
    for (const section of loadedIa.sections) {
      for (const page of section.pages) {
        pageIds.add(page.id);
        pagePaths.set(page.id, page.path);
      }
    }

    // Products: each detail page must exist in the IA. Non-external products
    // additionally follow the /products/{slug} detail-path convention. An
    // "external" product (whose `url` points outside /products/, e.g. the
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

    // Case studies (Req 4.1): each detail page must exist in the IA and its path
    // must follow the /work/{slug} convention (the renamed project detail
    // route family).
    for (const caseStudy of loadedCaseStudies as CaseStudy[]) {
      expect(pageIds.has(caseStudy.detailPageId)).toBe(true);
      expect(pagePaths.get(caseStudy.detailPageId)).toBe(
        `/work/${caseStudy.slug}`,
      );
    }

    // There is a dedicated Products section and a Work (case studies) section.
    const sectionIds = new Set(loadedIa.sections.map((s) => s.id));
    expect(sectionIds.has("products")).toBe(true);
    expect(sectionIds.has("work")).toBe(true);
  });

  it("presents no blog section or blog page entries in the IA", () => {
    // Req 7.7 / 7.5: the IA contains zero blog sections and zero blog page
    // entries after blog removal, so the validated content that gates the build
    // carries no blog artifacts.
    const result = loadContent(source, { failLoud: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { ia: loadedIa } = result.value;

    for (const section of loadedIa.sections) {
      expect(section.id).not.toBe("blog");
      for (const page of section.pages) {
        expect(page.id.startsWith("blog")).toBe(false);
        expect(page.path.startsWith("/blog")).toBe(false);
      }
    }
  });

  it("gives every case study the single confirmed consultancy engagementRole", () => {
    // design.md → "Cadocary's role (CONFIRMED)": every case study shares the same
    // confirmed consultancy positioning constant (the engagement-specific
    // deliverable is what varies). This guards against a case study drifting off
    // the confirmed positioning.
    const result = loadContent(source, { failLoud: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { caseStudies: loadedCaseStudies } = result.value;
    expect(loadedCaseStudies.length).toBeGreaterThan(0);

    const roles = new Set(loadedCaseStudies.map((cs) => cs.engagementRole));
    // Exactly one distinct engagementRole value across all case studies.
    expect(roles.size).toBe(1);

    // The single shared role names the confirmed consultancy positioning
    // (design & implementation, end-to-end, better and cheaper at once).
    const [sharedRole] = [...roles];
    expect(sharedRole).toBeTruthy();
    expect(sharedRole).toMatch(/design and implementation consultancy/i);
    expect(sharedRole).toMatch(/end-to-end/i);
    expect(sharedRole).toMatch(/better and cheaper/i);
  });
});
