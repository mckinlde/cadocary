/**
 * =============================================================================
 * Excluded-features + integration / smoke tests (task 15.3)
 * =============================================================================
 *
 * This suite closes out the "Integration / Smoke" and "Excluded features" rows
 * of the design's Testing Strategy for the corporate-site-positioning feature.
 * It works against the ACTUAL built site — it runs `astro build` once (in
 * `beforeAll`) and then asserts on the generated `dist/**\/*.html`, which is the
 * strongest, least-fragile way to verify what the site really renders (rather
 * than rendering individual `.astro` files in a unit harness). This proves the
 * excluded-feature guarantee holds on the *composed* output of EVERY page,
 * including the pages introduced by this feature — the Work index (`/work`), the
 * case-study detail pages (`/work/{slug}`), and the Services page (`/services`).
 * It complements those HTML assertions with model-level route resolution over
 * the real seed content.
 *
 * Coverage:
 *   - Excluded features on the composed, built pages (design → Testing Strategy
 *     → Excluded features), scanned across ALL pages incl. the new ones:
 *       - 10.1 zero site-wide search input elements on any page
 *       - 10.2 zero login controls, links, or forms on any page
 *       - 10.3 zero registration controls, links, or forms on any page
 *       - 10.5 pages load full content without prompting for authentication
 *   - Integration / Smoke (design → Testing Strategy → Integration / Smoke):
 *       - Route resolution over a representative set of real paths, including
 *         reserved (`/search`, `/login`, `/register` → not-found "reserved")
 *         and unknown ones, plus the new `/work/{slug}` case-study family
 *       - Snapshot-style composition check of the built home page (hero +
 *         mission + product catalog + case-study collection + nav + footer +
 *         JSON-LD)
 *
 * Requirements: 10.1, 10.2, 10.3, 10.5 (preserved feature exclusions), plus the
 * router's reserved/unknown → not-found behavior (10.4, 7.4).
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
// Note the post-repositioning content model: client work lives in
// `caseStudies.json` (replacing the old `projects.json`) and the Services page
// is driven by `services.json`.
import iaSeed from "../src/content/ia.json";
import productsSeed from "../src/content/products.json";
import caseStudiesSeed from "../src/content/caseStudies.json";
import servicesSeed from "../src/content/services.json";
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
  // We expect the full set of built pages: home, 404, product index + details,
  // the Work index (/work) + case-study details (/work/{slug}), and Services
  // (/services).
  expect(builtPages.length).toBeGreaterThanOrEqual(8);
}, 120_000);

/**
 * The pages introduced by the corporate-site-positioning feature. We assert the
 * build actually produced them so the excluded-feature scan below is known to
 * cover the NEW pages (Work index, case-study details, Services) and not just
 * the pre-existing home/products pages.
 */
const EXPECTED_NEW_PAGES = [
  "dist/work/index.html",
  "dist/work/spendlogic/index.html",
  "dist/work/hotels4truckers/index.html",
  "dist/work/purlpal/index.html",
  "dist/services/index.html",
];

/* =============================================================================
 * Excluded features (10.1–10.5) — scanned across every built page
 * ========================================================================== */

describe("Requirement 10: excluded features are absent from every built page", () => {
  it("built the new Work index, case-study detail, and Services pages so the exclusion scan covers them", () => {
    const files = new Set(builtPages.map((p) => p.file));
    const missing = EXPECTED_NEW_PAGES.filter((f) => !files.has(f));
    expect(missing, "expected new pages missing from the build").toEqual([]);
  });

  it("renders zero <input> elements on any page (10.1: no search input, and no field controls at all)", () => {
    const offenders = builtPages.filter((p) => /<input\b/i.test(p.html));
    expect(
      offenders.map((p) => p.file),
      "pages containing an <input> element",
    ).toEqual([]);
  });

  it("renders zero <form> elements on any page (10.1/10.2/10.3: no search, login, or registration forms)", () => {
    const offenders = builtPages.filter((p) => /<form\b/i.test(p.html));
    expect(offenders.map((p) => p.file), "pages containing a <form>").toEqual([]);
  });

  it("renders zero password fields on any page (10.2: no login credential entry)", () => {
    const offenders = builtPages.filter((p) =>
      /type\s*=\s*["']?password["']?/i.test(p.html),
    );
    expect(
      offenders.map((p) => p.file),
      "pages containing a password field",
    ).toEqual([]);
  });

  it("exposes no search / login / registration links or controls on any page (10.1, 10.2, 10.3)", () => {
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

  it("loads full page content with no authentication prompt (10.5)", () => {
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
  caseStudies: caseStudiesSeed,
  services: servicesSeed,
  slideDeck: slidesSeed,
  mission: missionSeed,
};

describe("Integration: route resolution over representative real paths (7.4, 10.4)", () => {
  const loaded = loadContent(source, { failLoud: false });
  if (!loaded.ok) {
    throw new Error(`seed content failed to load: ${loaded.error.message}`);
  }
  const { ia, products, caseStudies } = loaded.value;

  it("resolves valid IA pages (including the new Services and Work pages) to a page result", () => {
    // The blog is removed; the client-work section is now "Work" at /work. These
    // are all real IA pages in the repositioned model.
    for (const path of ["/", "/products", "/services", "/work", "/contact"]) {
      const result = resolveRoute(path, ia, products, caseStudies);
      expect(result.kind, `path ${path}`).toBe("page");
      if (result.kind === "page") {
        expect(result.page.path).toBe(path);
      }
    }
  });

  it("resolves the previously-existing blog paths to not-found (7.4)", () => {
    // Blog removal: the old blog index and any post path are simply absent from
    // the IA and match no parameterized prefix, so they resolve to unknown.
    for (const path of ["/blog", "/blog/some-old-post"]) {
      const result = resolveRoute(path, ia, products, caseStudies);
      expect(result.kind, `blog path ${path}`).toBe("not-found");
      if (result.kind === "not-found") {
        expect(result.reason).toBe("unknown");
      }
    }
  });

  it("resolves a product/case-study detail path to a real routable target (dedicated IA page wins over the parameterized route)", () => {
    // The seed IA declares dedicated pages for each product/case-study detail
    // path (/products/docketbot, /work/spendlogic, ...). Per the router's
    // documented precedence, an exact IA page match takes priority over the
    // parameterized /products/:slug and /work/:slug fallback. Either way the path
    // resolves to a concrete, renderable target (never not-found) — which is what
    // the integration smoke check cares about.
    const productDetail = resolveRoute("/products/docketbot", ia, products, caseStudies);
    expect(productDetail.kind).not.toBe("not-found");
    if (productDetail.kind === "page") {
      expect(productDetail.page.path).toBe("/products/docketbot");
    }

    const caseStudyDetail = resolveRoute(
      "/work/hotels4truckers",
      ia,
      products,
      caseStudies,
    );
    expect(caseStudyDetail.kind).not.toBe("not-found");
    if (caseStudyDetail.kind === "page") {
      expect(caseStudyDetail.page.path).toBe("/work/hotels4truckers");
    }
  });

  it("resolves a parameterized detail route (no dedicated IA page) via the product/case-study catalog", () => {
    // Exercise the parameterized /products/:slug and /work/:slug fallback in
    // isolation by removing the dedicated detail pages from the IA. The slug then
    // resolves against the product/case-study catalog, proving the fallback works.
    const strippedIa = {
      ...ia,
      sections: ia.sections.map((s) => ({
        ...s,
        pages: s.pages.filter(
          (p) =>
            !p.path.startsWith("/products/") && !p.path.startsWith("/work/"),
        ),
      })),
    };

    const product = resolveRoute("/products/docketbot", strippedIa, products, caseStudies);
    expect(product.kind).toBe("product");
    if (product.kind === "product") {
      expect(product.product.slug).toBe("docketbot");
    }

    const caseStudy = resolveRoute(
      "/work/hotels4truckers",
      strippedIa,
      products,
      caseStudies,
    );
    expect(caseStudy.kind).toBe("caseStudy");
    if (caseStudy.kind === "caseStudy") {
      expect(caseStudy.caseStudy.slug).toBe("hotels4truckers");
    }
  });

  it("resolves every reserved path (and trailing-slash/query variants) to not-found with reason \"reserved\" (10.4)", () => {
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
      const result = resolveRoute(path, ia, products, caseStudies);
      expect(result.kind, `reserved path ${JSON.stringify(path)}`).toBe(
        "not-found",
      );
      if (result.kind === "not-found") {
        expect(result.reason).toBe("reserved");
      }
    }
  });

  it("resolves unknown paths and unknown detail slugs to not-found (7.4)", () => {
    for (const path of ["/nope", "/products/does-not-exist", "/work/missing", "/about/unknown"]) {
      const result = resolveRoute(path, ia, products, caseStudies);
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

  it("includes the hero carousel (carousel-only hero — no capability/mission bubbles)", () => {
    const html = home();
    expect(html).toMatch(/<hero-carousel\b/i);
    expect(html).toMatch(/aria-roledescription="carousel"/i);
    // The Capability_Statement and Mission copy bubbles were intentionally
    // removed from the home hero; the positioning lives in the sections below.
    expect(html).not.toMatch(/aria-label="Mission statement"/i);
    expect(html).not.toMatch(/aria-label="What Cadocary builds"/i);
  });

  it("includes the product catalog and the case-study collection", () => {
    const html = home();
    expect(html).toMatch(/class="product-catalog"/i);
    expect(html).toContain("DocketBot");
    expect(html).toContain("ClientCheck");
    expect(html).toContain("Highlighter");
    // The old blog-style "project showcase" is replaced by the Case_Study
    // Collection, presented with outcome-oriented language and one card per
    // engagement (SpendLogic, Hotels4Truckers, PURLPal).
    expect(html).toMatch(/class="case-study-collection"/i);
    expect(html).toContain("SpendLogic");
    expect(html).toContain("Hotels4Truckers");
    expect(html).toContain("PURLPal");
  });

  it("presents the three top-level home sections with the Our Work subtitle", () => {
    const html = home();
    // Hybrid layout: Products, Services, and Case Studies each a top-level
    // section with its own heading + see-all link.
    expect(html).toMatch(/class="service-highlights"/i);
    expect(html).toContain("See all products");
    expect(html).toContain("See all services");
    expect(html).toContain("See all case studies");
    // The home Our Work section carries the descriptive subtitle.
    expect(html).toContain(
      "Our portfolio of software delivered on contract engagements with enterprise clients",
    );
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
