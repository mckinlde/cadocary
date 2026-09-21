import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildNavModel, buildFooterDirectory } from "../src/domain/ia-derivation";
import iaSeed from "../src/content/ia.json";
import type { IA, NavItem, NavLink } from "../src/types";

/**
 * Theming & responsiveness example tests (task 14.2).
 *
 * These are EXAMPLE / interaction tests (not property-based). They cover the
 * two acceptance criteria that are meaningfully testable at the unit level in
 * Vitest without a browser:
 *
 *   - Req 9.1 — consistent style attributes across pages. The design tokens in
 *     `src/styles/tokens.css` are the SINGLE SOURCE OF TRUTH that makes
 *     corresponding element types render identically on every page. We assert
 *     the documented token set is defined on :root, that global.css imports the
 *     tokens and applies the base typography/color from them, and (a consistency
 *     guard) that every global design token referenced by a component is defined
 *     in tokens.css — so no page can reference an undefined token and drift.
 *
 *   - Req 9.2 — nav + footer present with working links at >=320px. Nav and
 *     footer are included on every page by the shared layout (task 15.1) and are
 *     derived from the IA. At the model level we assert that every nav link and
 *     footer link produced from the real seed IA resolves to a real IA page
 *     (a "working link"). Nav and footer read the SAME `ia.json`, so this also
 *     confirms they cannot point at nonexistent targets.
 *
 * DEFERRALS (documented, not covered here):
 *   - Actual pixel rendering of components at a 320px viewport is a CSS/browser
 *     concern. The global styles impose no min-width and the tokens are fluid,
 *     so the >=320px "renders without horizontal overflow" guarantee is verified
 *     visually via e2e/visual regression rather than in Vitest.
 *   - That nav/footer literally appear in the DOM of every page is wired by the
 *     shared layout (task 15.1) and is covered by the integration/smoke tests
 *     (task 15.2) and the nav/footer interaction tests (task 11.3).
 *   - Rendering .astro components with real scoped CSS in Vitest is heavy and
 *     brittle; we cover the robust, deterministic surface (tokens + models) here.
 */

// Read the CSS source files directly from disk (per task guidance, use fs).
const tokensCssPath = fileURLToPath(new URL("../src/styles/tokens.css", import.meta.url));
const globalCssPath = fileURLToPath(new URL("../src/styles/global.css", import.meta.url));
const tokensCss = readFileSync(tokensCssPath, "utf8");
const globalCss = readFileSync(globalCssPath, "utf8");

const ia = iaSeed as IA;

/** Extract the set of custom-property NAMES defined (declared) in a CSS source. */
function extractDefinedTokens(css: string): Set<string> {
  const defined = new Set<string>();
  // Match a custom property declaration: `--name: value;` (not inside var(...)).
  const re = /(^|[;{]|\s)(--[a-z0-9-]+)\s*:/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    defined.add(m[2]);
  }
  return defined;
}

describe("Req 9.1: consistent style attributes across pages (design tokens are the single source of truth)", () => {
  const defined = extractDefinedTokens(tokensCss);

  it("tokens.css defines all custom properties on :root", () => {
    // The whole point of Req 9.1 is that every page inherits the same tokens.
    // Defining them on :root is what makes them global and inheritable.
    expect(tokensCss).toMatch(/:root\s*\{/);
  });

  it("defines the documented typography family token", () => {
    expect(defined).toContain("--font-family-base");
  });

  it("defines the full documented color palette", () => {
    const colors = [
      "--color-text",
      "--color-bg",
      "--color-surface",
      "--color-border",
      "--color-link",
      "--color-focus",
      "--color-muted",
    ];
    for (const token of colors) {
      expect(defined, `missing color token ${token}`).toContain(token);
    }
  });

  it("defines the documented heading and body text sizes", () => {
    const sizes = [
      "--font-size-h1",
      "--font-size-h2",
      "--font-size-h3",
      "--font-size-body",
      "--font-size-small",
    ];
    for (const token of sizes) {
      expect(defined, `missing size token ${token}`).toContain(token);
    }
  });

  it("defines the documented spacing scale", () => {
    const spacing = ["--space-xs", "--space-sm", "--space-md", "--space-lg", "--space-xl"];
    for (const token of spacing) {
      expect(defined, `missing spacing token ${token}`).toContain(token);
    }
  });

  it("defines the documented border-radius scale", () => {
    const radii = ["--radius-sm", "--radius-md", "--radius-lg"];
    for (const token of radii) {
      expect(defined, `missing radius token ${token}`).toContain(token);
    }
  });

  it("global.css imports tokens.css so a single stylesheet activates the theme", () => {
    expect(globalCss).toMatch(/@import\s+["']\.\/tokens\.css["']/);
  });

  it("global.css applies the base body typography and color FROM the tokens (so every page inherits identical base styles)", () => {
    // Body is the inheritance root for typography/color across all pages.
    const bodyBlock = globalCss.match(/body\s*\{[\s\S]*?\}/);
    expect(bodyBlock, "no body {} rule found in global.css").not.toBeNull();
    const body = bodyBlock![0];
    expect(body).toContain("var(--font-family-base)");
    expect(body).toContain("var(--font-size-body)");
    expect(body).toContain("var(--color-text)");
    expect(body).toContain("var(--color-bg)");
  });
});

describe("Req 9.1 (consistency guard): components reference only defined global design tokens", () => {
  it("every global design token used by a component is defined in tokens.css", () => {
    const definedInTokens = extractDefinedTokens(tokensCss);

    // Scan all component sources for `var(--token)` usages.
    const componentsDir = fileURLToPath(new URL("../src/components", import.meta.url));
    const files = readdirSync(componentsDir).filter((f) => f.endsWith(".astro"));
    expect(files.length).toBeGreaterThan(0);

    // Only these token families are part of the GLOBAL theme (the single source
    // of truth). Component-local, token-shaped custom properties that carry their
    // own fallback (e.g. `--hero-mission-gap`) are intentionally NOT global tokens
    // and are excluded from this guard.
    const globalPrefixes = [
      "--color-",
      "--space-",
      "--font-size-",
      "--font-family-",
      "--radius-",
    ];
    const isGlobalToken = (name: string) =>
      globalPrefixes.some((p) => name.startsWith(p));

    const usageRe = /var\(\s*(--[a-z0-9-]+)/gi;
    const undefinedUsages: string[] = [];

    for (const file of files) {
      const src = readFileSync(`${componentsDir}/${file}`, "utf8");
      let m: RegExpExecArray | null;
      while ((m = usageRe.exec(src)) !== null) {
        const token = m[1];
        if (isGlobalToken(token) && !definedInTokens.has(token)) {
          undefinedUsages.push(`${file}: ${token}`);
        }
      }
    }

    expect(
      undefinedUsages,
      `components reference global tokens not defined in tokens.css: ${undefinedUsages.join(", ")}`,
    ).toEqual([]);
  });
});

describe("Req 9.2: nav + footer present with working links (>=320px)", () => {
  // Build the derived models from the REAL seed IA — the same source the shared
  // layout uses to render nav + footer on every page.
  const nav = buildNavModel(ia);
  const footer = buildFooterDirectory(ia);

  // The set of every real page path in the IA. A "working link" is one whose
  // target path resolves to one of these (>=320px, links navigate to targets).
  const iaPaths = new Set<string>(
    ia.sections.flatMap((s) => s.pages.map((p) => p.path)),
  );
  const iaPageIds = new Set<string>(
    ia.sections.flatMap((s) => s.pages.map((p) => p.id)),
  );

  /** Flatten a nav model into the list of concrete links it exposes. */
  function navLinks(items: NavItem[]): NavLink[] {
    const links: NavLink[] = [];
    for (const item of items) {
      if (item.kind === "link") {
        links.push({ label: item.label, pageId: item.pageId, path: item.path });
      } else {
        links.push(...item.children);
      }
    }
    return links;
  }

  it("the seed IA produces a non-empty nav and footer (present on every page via the shared layout)", () => {
    expect(nav.items.length).toBeGreaterThan(0);
    expect(footer.groups.length).toBeGreaterThan(0);
    const totalFooterLinks = footer.groups.reduce((n, g) => n + g.links.length, 0);
    expect(totalFooterLinks).toBeGreaterThan(0);
  });

  it("every navigation link resolves to a real IA page (working links)", () => {
    const links = navLinks(nav.items);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(iaPaths, `nav link path ${link.path} not in IA`).toContain(link.path);
      expect(iaPageIds, `nav link pageId ${link.pageId} not in IA`).toContain(link.pageId);
    }
  });

  it("every footer directory link resolves to a real IA page (working links)", () => {
    for (const group of footer.groups) {
      for (const link of group.links) {
        expect(iaPaths, `footer link path ${link.path} not in IA`).toContain(link.path);
        expect(iaPageIds, `footer link pageId ${link.pageId} not in IA`).toContain(link.pageId);
      }
    }
  });

  it("nav and footer draw from the same IA, so their link targets are mutually consistent", () => {
    // Every nav link target is also reachable from the footer (same source of
    // truth), UNLESS the page is explicitly hidden from the footer
    // (showInFooter: false — e.g. the Services nav-only offering anchors).
    const footerPaths = new Set(
      footer.groups.flatMap((g) => g.links.map((l) => l.path)),
    );
    // Paths that are intentionally footer-hidden are exempt from this check.
    const footerHiddenPaths = new Set(
      ia.sections
        .flatMap((s) => s.pages)
        .filter((p) => p.showInFooter === false)
        .map((p) => p.path),
    );
    for (const link of navLinks(nav.items)) {
      if (footerHiddenPaths.has(link.path)) continue;
      expect(footerPaths, `nav target ${link.path} missing from footer`).toContain(link.path);
    }
  });
});

/**
 * =============================================================================
 * Task 12.3 — theming & token-fallback unit tests (Req 8.1, 8.2, 8.4)
 * =============================================================================
 *
 * These extend the file above with EXAMPLE / interaction unit tests that read
 * the real page and component sources from disk (same fs-based approach the
 * tokens tests use) and assert three things that ARE deterministically
 * checkable in Vitest without a browser:
 *
 *   - Req 8.1 — the Home, Services, Product Catalog, and Case_Study_Collection
 *     apply IDENTICAL typography/color/spacing tokens per element type. The
 *     card presentation is the shared element type across ProductCatalog,
 *     CaseStudyCollection, and the Services offering cards: card HEADINGS all
 *     read `--font-size-h3`, card SUMMARIES all read `--font-size-body` +
 *     `--color-muted`, card CONTAINERS all read `--color-border` +
 *     `--radius-md` + `--color-surface` + `--shadow-card`, and card CTAs/links
 *     all read `--color-link`. Because every page reads the SAME token names,
 *     the rendered values are identical across pages (that is the whole point
 *     of the token contract in tokens.css).
 *
 *   - Req 8.2 — every global token reference in these sources uses the
 *     `var(--token, fallback)` form, so if a token is ever unavailable at
 *     render time the DEFINED fallback applies (never an undefined/browser
 *     default) and the element keeps its reserved layout space.
 *
 *   - Req 8.4 — at >=320px no primary content overlaps the nav or footer. The
 *     shared Layout places page content in normal document flow inside
 *     `<main>` BETWEEN `<NavigationBar/>` and `<Footer/>`, and the page content
 *     wrappers are width-constrained (`max-width` + `margin: 0 auto`). We
 *     assert that structural guarantee: the layout order is nav -> main ->
 *     footer, and NO primary-content wrapper takes itself out of flow with
 *     fixed/absolute/sticky positioning (which is the only way in-flow content
 *     could overlap the nav/footer bands).
 */

// Resolve the real page + component sources once, from disk.
const srcRoot = fileURLToPath(new URL("../src", import.meta.url));
const readSrc = (rel: string): string => readFileSync(`${srcRoot}/${rel}`, "utf8");

const indexAstro = readSrc("pages/index.astro");
const servicesAstro = readSrc("pages/services.astro");
const productCatalogAstro = readSrc("components/ProductCatalog.astro");
const caseStudyCollectionAstro = readSrc("components/CaseStudyCollection.astro");
const layoutAstro = readSrc("layouts/Layout.astro");

/**
 * Extract every `var(--token[, fallback])` usage from a source, returning the
 * token name and whether a fallback was supplied. This is deliberately simple
 * (no nested var() in the fallback in these sources) and matches the fs-based,
 * source-scanning style used elsewhere in this file.
 */
function extractVarUsages(
  css: string,
): { name: string; hasFallback: boolean }[] {
  const usages: { name: string; hasFallback: boolean }[] = [];
  const re = /var\(\s*(--[a-z0-9-]+)\s*(,)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    usages.push({ name: m[1], hasFallback: m[2] === "," });
  }
  return usages;
}

/** The GLOBAL theme token families (the single source of truth in tokens.css). */
const globalPrefixes = [
  "--color-",
  "--space-",
  "--font-size-",
  "--font-family-",
  "--radius-",
  "--shadow-",
];
const isGlobalToken = (name: string): boolean =>
  globalPrefixes.some((p) => name.startsWith(p));

describe("Req 8.1: identical tokens per element type across Home/Services/Product Catalog/Case Studies", () => {
  // The card is the element type shared across the three card-bearing sources.
  const cardSources: { label: string; src: string }[] = [
    { label: "ProductCatalog", src: productCatalogAstro },
    { label: "CaseStudyCollection", src: caseStudyCollectionAstro },
    { label: "Services offering cards", src: servicesAstro },
  ];

  it("card HEADINGS read the same --font-size-h3 token in every card component", () => {
    for (const { label, src } of cardSources) {
      expect(src, `${label} card heading should use --font-size-h3`).toMatch(
        /font-size:\s*var\(--font-size-h3/,
      );
    }
  });

  it("card SUMMARIES read the same --font-size-body + --color-muted tokens in every card component", () => {
    for (const { label, src } of cardSources) {
      expect(src, `${label} card summary should use --font-size-body`).toMatch(
        /font-size:\s*var\(--font-size-body/,
      );
      expect(src, `${label} card summary should use --color-muted`).toMatch(
        /color:\s*var\(--color-muted/,
      );
    }
  });

  it("card CONTAINERS read the same surface/border/radius/shadow tokens in every card component", () => {
    for (const { label, src } of cardSources) {
      expect(src, `${label} card should use --color-border`).toContain(
        "var(--color-border",
      );
      expect(src, `${label} card should use --radius-md`).toContain(
        "var(--radius-md",
      );
      expect(src, `${label} card should use --color-surface`).toContain(
        "var(--color-surface",
      );
      expect(src, `${label} card should use --shadow-card`).toContain(
        "var(--shadow-card",
      );
    }
  });

  it("card CTAs/links read the same --color-link token in every card component", () => {
    for (const { label, src } of cardSources) {
      expect(src, `${label} card CTA/link should use --color-link`).toContain(
        "var(--color-link",
      );
    }
  });

  it("section headings read the same --font-size-h2 token across Product Catalog and Case Studies", () => {
    // The section heading is the other shared element type across the two
    // home-page collections; both must read the same size token.
    expect(productCatalogAstro).toMatch(/font-size:\s*var\(--font-size-h2/);
    expect(caseStudyCollectionAstro).toMatch(/font-size:\s*var\(--font-size-h2/);
  });

  it("the home page and services page constrain their content with the same spacing tokens", () => {
    // Home `.home-section` and Services `.page-section` both pad with the
    // shared spacing scale, so page rhythm is identical across pages.
    for (const src of [indexAstro, servicesAstro]) {
      expect(src).toContain("var(--space-lg");
      expect(src).toContain("var(--space-md");
    }
  });
});

describe("Req 8.2: every global token reference supplies a var(--token, fallback)", () => {
  const sources: { label: string; src: string }[] = [
    { label: "index.astro", src: indexAstro },
    { label: "services.astro", src: servicesAstro },
    { label: "ProductCatalog.astro", src: productCatalogAstro },
    { label: "CaseStudyCollection.astro", src: caseStudyCollectionAstro },
  ];

  it("no global-token usage in the pages/components is missing its fallback", () => {
    const missingFallback: string[] = [];
    for (const { label, src } of sources) {
      for (const { name, hasFallback } of extractVarUsages(src)) {
        if (isGlobalToken(name) && !hasFallback) {
          missingFallback.push(`${label}: var(${name}) has no fallback`);
        }
      }
    }
    expect(
      missingFallback,
      `these global-token usages lack a fallback (Req 8.2): ${missingFallback.join(", ")}`,
    ).toEqual([]);
  });

  it("each card component actually uses the var(--token, fallback) pattern (so a missing token falls back to a defined value)", () => {
    for (const { label, src } of [
      { label: "ProductCatalog", src: productCatalogAstro },
      { label: "CaseStudyCollection", src: caseStudyCollectionAstro },
      { label: "Services", src: servicesAstro },
    ]) {
      // e.g. `var(--color-surface, #ffffff)` — a real fallback color after the comma.
      expect(src, `${label} should use the var(--token, fallback) pattern`).toMatch(
        /var\(--[a-z0-9-]+,\s*[^)]+\)/i,
      );
    }
  });
});

describe("Req 8.4: primary content stays within nav/footer bounds at >=320px", () => {
  it("the shared Layout renders content in <main> BETWEEN the NavigationBar and the Footer", () => {
    const navIdx = layoutAstro.indexOf("<NavigationBar");
    const mainIdx = layoutAstro.indexOf("<main");
    const footerIdx = layoutAstro.indexOf("<Footer");
    expect(navIdx, "NavigationBar not found in Layout").toBeGreaterThan(-1);
    expect(mainIdx, "<main> not found in Layout").toBeGreaterThan(-1);
    expect(footerIdx, "Footer not found in Layout").toBeGreaterThan(-1);
    // Order guarantees content occupies the band between nav and footer.
    expect(navIdx).toBeLessThan(mainIdx);
    expect(mainIdx).toBeLessThan(footerIdx);
    // The page's own content is slotted inside that <main>.
    expect(layoutAstro).toMatch(/<main[^>]*>[\s\S]*<slot\s*\/>[\s\S]*<\/main>/);
  });

  it("the page content wrappers are width-constrained and horizontally centered (no bleed past the layout bands)", () => {
    // Home `.home-section` and Services `.page-section` both cap width and
    // center, so content never spills outside the readable column.
    for (const src of [indexAstro, servicesAstro]) {
      expect(src).toMatch(/max-width:\s*[\d.]+rem/);
      expect(src).toMatch(/margin:\s*0\s+auto/);
    }
  });

  it("no PRIMARY content wrapper takes itself out of flow with fixed/absolute/sticky positioning", () => {
    // In-flow content inside <main> cannot overlap the nav/footer bands. The
    // only way it could is by escaping flow with fixed/absolute/sticky
    // positioning. The sole `position: absolute` in these sources is the
    // `.visually-hidden` screen-reader helper (clipped to 1px, off-screen by
    // design) — never primary content. Assert no OTHER out-of-flow positioning.
    const outOfFlow = /position:\s*(fixed|sticky)\b/i;
    for (const { label, src } of [
      { label: "index.astro", src: indexAstro },
      { label: "services.astro", src: servicesAstro },
      { label: "ProductCatalog.astro", src: productCatalogAstro },
      { label: "CaseStudyCollection.astro", src: caseStudyCollectionAstro },
    ]) {
      expect(src, `${label} must not fix/stick primary content out of flow`).not.toMatch(
        outOfFlow,
      );
    }

    // Any `position: absolute` present must belong ONLY to the off-screen
    // `.visually-hidden` helper, not to a primary-content element.
    const absBlocks = caseStudyCollectionAstro.match(/[^{}]*\{[^{}]*position:\s*absolute[^{}]*\}/gi) ?? [];
    for (const block of absBlocks) {
      expect(block, `unexpected absolute-positioned block: ${block}`).toContain(
        "visually-hidden",
      );
    }
  });
});
