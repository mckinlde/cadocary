/**
 * =============================================================================
 * Blog-removal smoke check
 * =============================================================================
 *
 * This smoke test is the "did the blog really go away?" build gate for the
 * blog-removal work (tasks 13.1 → 13.2). It asserts, against the ACTUAL shipped
 * project, that every trace of the removed blog is gone:
 *
 *   - the blog source files are physically absent (`src/content/blog.ts` and the
 *     whole `src/pages/blog/` route folder), so no blog pages/routes generate
 *     (Requirement 7.1);
 *   - no retained source file (pages, components, layouts, content, styles) — nor
 *     any generated sitemap or page metadata — carries a `/blog` link/route
 *     reference (Requirements 7.6, 7.8);
 *   - the Information Architecture (`ia.json`) contains zero blog sections and
 *     zero blog page entries, so the IA-derived Navigation_Bar and Footer present
 *     zero blog links by construction (Requirement 7.7, and 7.2/7.3 downstream);
 *   - the router resolves any previously-existing `/blog` URL (the index and any
 *     post detail path) to a not-found result (Requirement 7.4, cross-checked).
 *
 * The nav and footer both derive purely from `ia.json` via
 * `buildNavModel` / `buildFooterDirectory` (see `src/domain/ia-derivation.ts`),
 * so asserting the IA is blog-free AND asserting the derived models carry no
 * `/blog` links together prove there is no blog entry in nav or footer.
 *
 * Traceability: Requirements 7.1, 7.6, 7.7, 7.8.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

import { resolveRoute } from "../src/domain/router";
import { buildNavModel, buildFooterDirectory } from "../src/domain/ia-derivation";
import type { IA, Product, CaseStudy } from "../src/types";

// The real, shipped content documents. Imported directly so this test asserts
// against exactly what the site builds with.
import iaData from "../src/content/ia.json";
import products from "../src/content/products.json";
import caseStudies from "../src/content/caseStudies.json";

const ia = iaData as IA;

// Repo layout anchors. This test file lives in `<project>/test/`, so the project
// root is one level up and `src/` sits beside it.
const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(TEST_DIR, "..");
const SRC_DIR = join(PROJECT_ROOT, "src");

/**
 * A `/blog` reference we consider a real link/route: the literal path token
 * `/blog` at a path boundary (end of string, or followed by `/`, a quote, a
 * backtick, whitespace, `)`, `?`, or `#`). This deliberately does NOT match the
 * bare word "blog" appearing in prose/comments (e.g. "the old blog-style
 * presentation"), only an actual `/blog` URL/route reference — which is what
 * Requirements 7.6 and 7.8 forbid in retained content, sitemap, and metadata.
 */
const BLOG_PATH_REFERENCE = /\/blog(?=$|[/'"`)\s?#])/;

/** Recursively collect every file under `dir`. */
function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

/** Every top-level IA page (flattened across sections). */
const allPages = ia.sections.flatMap((section) => section.pages);

describe("blog removal smoke check", () => {
  describe("removed blog source files are absent (Req 7.1)", () => {
    it("src/content/blog.ts does not exist", () => {
      expect(existsSync(join(SRC_DIR, "content", "blog.ts"))).toBe(false);
    });

    it("the src/pages/blog/ route folder does not exist", () => {
      expect(existsSync(join(SRC_DIR, "pages", "blog"))).toBe(false);
    });

    it("no blog route files exist anywhere under src/pages", () => {
      const pagesDir = join(SRC_DIR, "pages");
      const blogRouteFiles = walkFiles(pagesDir).filter((f) => {
        const rel = relative(pagesDir, f).split("\\").join("/");
        // Any file inside a `blog/` route segment would generate a /blog route.
        return rel === "blog" || rel.startsWith("blog/") || rel.includes("/blog/");
      });
      expect(blogRouteFiles).toEqual([]);
    });
  });

  describe("no /blog references in retained source, sitemap, or metadata (Req 7.6, 7.8)", () => {
    it("no retained source file contains a /blog link/route reference", () => {
      const offenders: string[] = [];
      for (const file of walkFiles(SRC_DIR)) {
        const contents = readFileSync(file, "utf8");
        if (BLOG_PATH_REFERENCE.test(contents)) {
          offenders.push(relative(PROJECT_ROOT, file));
        }
      }
      expect(offenders).toEqual([]);
    });

    it("no IA page path is a /blog path (nav/footer/sitemap/metadata derive from the IA)", () => {
      const blogPaths = allPages
        .map((page) => page.path)
        .filter((path) => BLOG_PATH_REFERENCE.test(path) || path === "/blog");
      expect(blogPaths).toEqual([]);
    });
  });

  describe("the IA contains zero blog sections and zero blog pages (Req 7.7)", () => {
    it("no section is a blog section (by id or label)", () => {
      const blogSections = ia.sections.filter((section) => {
        const id = section.id.toLowerCase();
        const label = section.label.toLowerCase();
        return id === "blog" || id.includes("blog") || label.includes("blog");
      });
      expect(blogSections).toEqual([]);
    });

    it("no page is a blog page (by id, label, or path)", () => {
      const blogPages = allPages.filter((page) => {
        const id = page.id.toLowerCase();
        const label = page.label.toLowerCase();
        return (
          id === "blog" ||
          id.includes("blog") ||
          label.includes("blog") ||
          BLOG_PATH_REFERENCE.test(page.path) ||
          page.path === "/blog"
        );
      });
      expect(blogPages).toEqual([]);
    });
  });

  describe("nav and footer (IA-derived) present zero blog links (Req 7.2, 7.3 downstream of 7.7)", () => {
    it("the derived navigation model carries no /blog link", () => {
      const nav = buildNavModel(ia);
      const navPaths: string[] = [];
      for (const item of nav.items) {
        if (item.kind === "link") {
          navPaths.push(item.path);
        } else {
          for (const child of item.children) navPaths.push(child.path);
        }
      }
      const blogNavPaths = navPaths.filter(
        (path) => BLOG_PATH_REFERENCE.test(path) || path === "/blog",
      );
      expect(blogNavPaths).toEqual([]);
    });

    it("the derived footer directory carries no /blog link", () => {
      const footer = buildFooterDirectory(ia);
      const footerPaths = footer.groups.flatMap((group) =>
        group.links.map((link) => link.path),
      );
      const blogFooterPaths = footerPaths.filter(
        (path) => BLOG_PATH_REFERENCE.test(path) || path === "/blog",
      );
      expect(blogFooterPaths).toEqual([]);
    });
  });

  describe("previously-existing blog URLs resolve to not-found (Req 7.4 cross-check)", () => {
    const blogUrls = [
      "/blog",
      "/blog/",
      "/blog/hello-world",
      "/blog/2023/some-post",
      "/blog/index",
    ];

    for (const url of blogUrls) {
      it(`resolveRoute("${url}") is not-found`, () => {
        const result = resolveRoute(
          url,
          ia,
          products as Product[],
          caseStudies as CaseStudy[],
        );
        expect(result.kind).toBe("not-found");
      });
    }
  });
});
