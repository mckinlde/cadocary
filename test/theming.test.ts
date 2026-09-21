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
    // truth), unless the page is explicitly hidden from the footer. Since the
    // seed IA hides nothing, all nav targets appear in the footer too.
    const footerPaths = new Set(
      footer.groups.flatMap((g) => g.links.map((l) => l.path)),
    );
    for (const link of navLinks(nav.items)) {
      expect(footerPaths, `nav target ${link.path} missing from footer`).toContain(link.path);
    }
  });
});
