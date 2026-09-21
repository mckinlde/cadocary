/**
 * =============================================================================
 * Excluded-features + integration / smoke tests (task 15.2)
 * =============================================================================
 *
 * This suite closes out the "Integration / Smoke" and "Excluded features" rows
 * of the design's Testing Strategy. It works against the ACTUAL built site — it
 * runs `astro build` once (in `beforeAll`) and then asserts on the generated
 * `dist/**\/*.html`, which is the strongest, least-fragile way to verify what
 * the site really renders (rather than rendering individual `.astro` files in a
 * unit harness). It complements those HTML assertions with model-level route
 * resolution over the real seed content.
 *
 * Coverage:
 *   - Excluded features on the composed, built pages (design → Testing Strategy
 *     → Excluded features):
 *       - 8.1 zero site-wide search input elements
 *       - 8.2 zero login controls, links, or forms
 *       - 8.3 zero registration controls, links, or forms
 *       - 8.4 pages load full content without any auth prompt
 *   - Integration / Smoke (design → Testing Strategy → Integration / Smoke):
 *       - Route resolution over a representative set of real paths, including
 *         reserved and unknown ones (7.6, 8.5)
 *       - Snapshot-style composition check of the built home page (hero +
 *         mission + product catalog + project showcase + nav + footer + JSON-LD)
 *
 * Requirements: 7.6, 8.1, 8.2, 8.3, 8.4, 8.5.
 *
 * NOTE ON APPROACH: a build-then-scan is used deliberately. The task allows a
 * source-level scan as a fallback, but scanning the built HTML proves the actual
 * shipped output — including anything a component or layout could have injected —
 * contains none of the excluded controls. The build is run a single time for the
 * whole file to keep it fast.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { loadContent, type ContentSource } from "../src/domain/content-loader";
import { resolveRoute } from "../src/domain/router";

// The real, shipped content documents — the same ones the site builds with.
import iaSeed from "../src/content/ia.json";
import productsSeed from "../src/content/products.json";
import projectsSeed from "../src/content/projects.json";
import slidesSeed from "../src/content/slides.json";
import missionSeed from "../src/content/mission.json";

/* =============================================================================
 * Build the site once, then collect every generated HTML file.
 * ========================================================================== */

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const distDir = fileURLToPath(new URL("../dist", import.meta.url));

/** Recursively collect absolute paths of every *.html file under `dir`. */
function collectHtmlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...collectHtmlFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      out.push(full);
    }
  }
  return out;
}

interface BuiltPage {
  file: string;
  html: string;
}

let builtPages: BuiltPage[] = [];

beforeAll(() => {
  // Produce a fresh build so the scan reflects the current source. Astro's build
  // is quick for this static site; a single invocation covers the whole suite.
  execFileSync("npm", ["run", "build"], {
    cwd: projectRoot,
    stdio: "ignore",
  });

  expect(existsSync(distDir), "dist/ should exist after the build").toBe(true);
  const files = collectHtmlFiles(distDir);
  builtPages = files.map((file) => ({
    file: file.replace(distDir, "dist"),
    html: readFileSync(file, "utf8"),
  }));
  // We expect the full set of built pages (home, 404, product/project indexes
  // and details).
  expect(builtPages.length).toBeGreaterThanOrEqual(8);
}, 120_000);

/* =============================================================================
 * Excluded features (8.1–8.4) — scanned across every built page
 * ========================================================================== */

describe("Requirement 8: excluded features are absent from every built page", () => {
  it("renders zero <input> elements on any page (8.1: no search input, and no field controls at all)", () => {
    const offenders = builtPages.filter((p) => /<input\b/i.test(p.html));
    expect(
      offenders.map((p) => p.file),
      "pages containing an <input> element",
    ).toEqual([]);
  });

  it("renders zero <form> elements on any page (8.1/8.2/8.3: no search, login, or registration forms)", () => {
    const offenders = builtPages.filter((p) => /<form\b/i.test(p.html));
    expect(offenders.map((p) => p.file), "pages containing a <form>").toEqual([]);
  });

  it("renders zero password fields on any page (8.2: no login credential entry)", () => {
    const offenders = builtPages.filter((p) =>
      /type\s*=\s*["']?password["']?/i.test(p.html),
    );
    expect(
      offenders.map((p) => p.file),
      "pages containing a password field",
    ).toEqual([]);
  });

  it("exposes no search / login / registration links or controls on any page (8.1, 8.2, 8.3)", () => {
    // Any anchor/button/link that targets a reserved area, or any control
    // labelled as search/login/register, would expose an excluded feature.
    const reservedHrefRe =
      /(?:href|action)\s*=\s*["']\s*\/?(?:search|login|log-in|signin|sign-in|register|signup|sign-up)\b/i;
    // NOTE: the bare word "search" is intentionally NOT in this control-label
    // regex — it appears in legitimate product prose (e.g. Highlighter's
    // "in-browser semantic search"). Dedicated search *controls* are still
    // caught below via the search input type and role=search checks, so the
    // excluded-feature guarantee is preserved without false positives on copy.
    const controlWordRe =
      /\b(?:sign\s?in|log\s?in|register|sign\s?up|create account)\b/i;

    const offenders: string[] = [];
    for (const page of builtPages) {
      // 1. Links/forms pointing at a reserved destination.
      if (reservedHrefRe.test(page.html)) {
        offenders.push(`${page.file} (reserved href/action)`);
      }
      // 2. A dedicated search control (search input type or role=search).
      if (/type\s*=\s*["']?search["']?/i.test(page.html)) {
        offenders.push(`${page.file} (search input type)`);
      }
      if (/role\s*=\s*["']search["']/i.test(page.html)) {
        offenders.push(`${page.file} (role=search)`);
      }
      // 3. Buttons/anchors whose visible text is a login/register/search action.
      const buttonMatches = page.html.match(
        /<(?:button|a)\b[^>]*>[\s\S]*?<\/(?:button|a)>/gi,
      );
      if (buttonMatches) {
        for (const el of buttonMatches) {
          // Strip tags to inspect the visible label only.
          const text = el.replace(/<[^>]+>/g, " ");
          if (controlWordRe.test(text)) {
            offenders.push(`${page.file} (control labelled "${text.trim().slice(0, 40)}")`);
          }
        }
      }
    }

    expect(offenders, "excluded search/login/registration controls found").toEqual(
      [],
    );
  });

  it("loads full page content with no authentication prompt (8.4)", () => {
    // Full content: every REDESIGN page carries the shared shell (nav + footer +
    // main content region). No page gates content behind an auth wall.
    //
    // Some pages are intentionally carried over VERBATIM as static passthrough
    // assets (from public/) rather than rendered on the redesign layout, so they
    // legitimately lack the shared nav/footer/main shell. They are excluded from
    // the shared-shell assertions but are STILL scanned for excluded controls
    // (search/login/registration) by the tests above. These are:
    //   - the prebuilt Highlighter ML app at /highlighter/, and
    //   - the legacy Stripe checkout redirect pages at /docketbot/cancel.html
    //     and /docketbot/success.html, preserved so existing payment-flow URLs
    //     keep working after the redesign cutover.
    const authPromptRe =
      /\b(?:please\s+log\s?in|sign\s?in to continue|authentication required|you must be logged in|enter your password)\b/i;

    const isPassthrough = (file: string): boolean =>
      file.startsWith("dist/highlighter/") ||
      file === "dist/docketbot/cancel.html" ||
      file === "dist/docketbot/success.html";

    const shellPages = builtPages.filter((p) => !isPassthrough(p.file));

    for (const page of shellPages) {
      expect(page.html, `${page.file} missing nav`).toMatch(/<nav\b/i);
      expect(page.html, `${page.file} missing footer`).toMatch(/<footer\b/i);
      expect(page.html, `${page.file} missing main content`).toMatch(/<main\b/i);
      expect(
        authPromptRe.test(page.html),
        `${page.file} contains an authentication prompt`,
      ).toBe(false);
    }
  });
});

/* =============================================================================
 * Integration / Smoke — route resolution over representative real paths
 * ========================================================================== */

const source: ContentSource = {
  ia: iaSeed,
  products: productsSeed,
  projects: projectsSeed,
  slideDeck: slidesSeed,
  mission: missionSeed,
};

describe("Integration: route resolution over representative real paths (7.6, 8.5)", () => {
  const loaded = loadContent(source, { failLoud: false });
  if (!loaded.ok) {
    throw new Error(`seed content failed to load: ${loaded.error.message}`);
  }
  const { ia, products, projects } = loaded.value;

  it("resolves valid IA pages to a page result", () => {
    for (const path of ["/", "/products", "/services", "/projects", "/blog", "/contact"]) {
      const result = resolveRoute(path, ia, products, projects);
      expect(result.kind, `path ${path}`).toBe("page");
      if (result.kind === "page") {
        expect(result.page.path).toBe(path);
      }
    }
  });

  it("resolves a product/project detail path to a real routable target (dedicated IA page wins over the parameterized route)", () => {
    // The seed IA declares dedicated pages for each product/project detail path
    // (/products/atlas, /projects/riverside-portal, ...). Per the router's
    // documented precedence, an exact IA page match takes priority over the
    // parameterized /products/:slug and /projects/:slug fallback. Either way the
    // path resolves to a concrete, renderable target (never not-found) — which is
    // what the integration smoke check cares about.
    const productDetail = resolveRoute("/products/docketbot", ia, products, projects);
    expect(productDetail.kind).not.toBe("not-found");
    if (productDetail.kind === "page") {
      expect(productDetail.page.path).toBe("/products/docketbot");
    }

    const projectDetail = resolveRoute(
      "/projects/hotels4truckers",
      ia,
      products,
      projects,
    );
    expect(projectDetail.kind).not.toBe("not-found");
    if (projectDetail.kind === "page") {
      expect(projectDetail.page.path).toBe("/projects/hotels4truckers");
    }
  });

  it("resolves a parameterized detail route (no dedicated IA page) via the product/project catalog", () => {
    // Exercise the parameterized /products/:slug and /projects/:slug fallback in
    // isolation by removing the dedicated detail pages from the IA. The slug then
    // resolves against the product/project catalog, proving the fallback works.
    const strippedIa = {
      ...ia,
      sections: ia.sections.map((s) => ({
        ...s,
        pages: s.pages.filter(
          (p) =>
            !p.path.startsWith("/products/") && !p.path.startsWith("/projects/"),
        ),
      })),
    };

    const product = resolveRoute("/products/docketbot", strippedIa, products, projects);
    expect(product.kind).toBe("product");
    if (product.kind === "product") {
      expect(product.product.slug).toBe("docketbot");
    }

    const project = resolveRoute(
      "/projects/hotels4truckers",
      strippedIa,
      products,
      projects,
    );
    expect(project.kind).toBe("project");
    if (project.kind === "project") {
      expect(project.project.slug).toBe("hotels4truckers");
    }
  });

  it("resolves every reserved path (and trailing-slash/query variants) to not-found (8.5)", () => {
    const variants = [
      "/search",
      "/login",
      "/register",
      "/search/",
      "/login?next=/",
      "/register#top",
      "  /search  ",
    ];
    for (const path of variants) {
      const result = resolveRoute(path, ia, products, projects);
      expect(result.kind, `reserved path ${JSON.stringify(path)}`).toBe(
        "not-found",
      );
      if (result.kind === "not-found") {
        expect(result.reason).toBe("reserved");
      }
    }
  });

  it("resolves unknown paths and unknown detail slugs to not-found (7.6)", () => {
    for (const path of ["/nope", "/products/does-not-exist", "/projects/missing", "/about/unknown"]) {
      const result = resolveRoute(path, ia, products, projects);
      expect(result.kind, `unknown path ${path}`).toBe("not-found");
      if (result.kind === "not-found") {
        expect(result.reason).toBe("unknown");
      }
    }
  });
});

/* =============================================================================
 * Integration / Smoke — composition of the built home page
 * ========================================================================== */

describe("Integration: the built home page composes all expected regions", () => {
  function home(): string {
    const page = builtPages.find((p) => p.file === "dist/index.html");
    expect(page, "dist/index.html should exist").toBeDefined();
    return page!.html;
  }

  it("includes the shared shell: navigation bar and footer directory", () => {
    const html = home();
    expect(html).toMatch(/<nav[^>]*aria-label="Primary"/i);
    expect(html).toMatch(/<footer\b/i);
    expect(html).toMatch(/Footer directory/i);
  });

  it("includes the hero carousel and the mission statement beneath it", () => {
    const html = home();
    expect(html).toMatch(/<hero-carousel\b/i);
    expect(html).toMatch(/aria-roledescription="carousel"/i);
    // Mission region and its authored heading are present without interaction.
    expect(html).toMatch(/aria-label="Mission statement"/i);
    expect(html).toContain("favorite button");
  });

  it("includes the product catalog and the project showcase", () => {
    const html = home();
    expect(html).toMatch(/class="product-catalog"/i);
    expect(html).toContain("DocketBot");
    expect(html).toContain("ClientCheck");
    expect(html).toContain("Highlighter");
    expect(html).toMatch(/class="project-showcase"/i);
    expect(html).toContain("hotels4truckers.com");
    expect(html).toContain("purlpal.ai");
    expect(html).toContain("spendlogic.com");
  });

  it("emits WebPage, WebSite, and navigation ItemList JSON-LD structured data", () => {
    const html = home();
    const jsonLdBlocks = [
      ...html.matchAll(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi,
      ),
    ].map((m) => JSON.parse(m[1]) as { "@type": string });

    const types = jsonLdBlocks.map((b) => b["@type"]);
    expect(types).toContain("WebPage");
    expect(types).toContain("WebSite");
    expect(types).toContain("ItemList");
  });
});
