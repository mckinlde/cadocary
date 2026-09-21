/**
 * IA-derived navigation and footer — the SINGLE SOURCE OF TRUTH derivation.
 *
 * ---------------------------------------------------------------------------
 * DESIGN DECISION: Single-source-of-truth Information Architecture
 * ---------------------------------------------------------------------------
 * The Navigation_Bar model and the Footer Directory model are BOTH derived,
 * by the pure functions in this module, from the SAME `ia.json` document
 * (an `IA` value). Neither nav nor footer maintains its own hand-authored list
 * of links.
 *
 * The advantage: nav and footer cannot drift out of sync. Adding or removing a
 * page (a `PageRef`) in the IA, or reordering/renaming a section, automatically
 * updates BOTH the navigation and the footer in a single edit — there is no
 * second place to remember to update, so the two views are consistent by
 * construction. This is why the IA is the single source of truth for site
 * structure (design.md → "Information Architecture as Single Source of Truth").
 *
 * Visibility is controlled per page: `PageRef.showInNav` and
 * `PageRef.showInFooter` both DEFAULT TO TRUE when omitted, so a plain page
 * appears in both views unless explicitly hidden from one of them.
 *
 * These functions are pure and deterministic (IA in, model out): they never
 * mutate their input and never touch the DOM, so they are reusable by the
 * presentation layer (NavigationBar / Footer components) and property-testable
 * in isolation (Correctness Properties 1 and 2).
 *
 * Design references:
 *   - design.md → Architecture → Information Architecture as Single Source of Truth
 *   - design.md → Components and Interfaces → Footer Directory
 *   - design.md → Correctness Property 1 (Navigation derivation mirrors the IA)
 *   - design.md → Correctness Property 2 (Footer directory mirrors the IA)
 *   - Requirements 1.2, 2.1, 2.5 (navigation), 7.2, 7.3, 7.4, 7.7, 7.8 (footer)
 */

import type {
  IA,
  Section,
  PageRef,
  NavModel,
  NavItem,
  NavLink,
  FooterDirectory,
  FooterGroup,
  FooterLink,
} from "../types";

/**
 * Whether a page should appear in the navigation bar. `showInNav` defaults to
 * `true` when omitted, so a page is nav-visible unless it is explicitly hidden.
 */
function isNavVisible(page: PageRef): boolean {
  return page.showInNav !== false;
}

/**
 * Whether a page should appear in the footer directory. `showInFooter` defaults
 * to `true` when omitted, so a page is footer-visible unless explicitly hidden.
 */
function isFooterVisible(page: PageRef): boolean {
  return page.showInFooter !== false;
}

/**
 * Build the Navigation_Bar model from the Information Architecture.
 *
 * Behavior (Correctness Property 1; Requirements 1.2, 2.1, 2.5):
 *   - Sections are considered in their existing order; the produced top-level
 *     items preserve that section order.
 *   - Only nav-visible pages (`showInNav !== false`) count. A section with NO
 *     nav-visible pages produces NO nav item, so nav items correspond one-to-one
 *     with the *nav-visible sections* of the IA.
 *   - A section with EXACTLY ONE nav-visible page yields a `link` item pointing
 *     directly at that page's path (Requirement 1.2 — a top-level item that links
 *     directly to a Page).
 *   - A section with TWO OR MORE nav-visible pages yields a `menu` item whose
 *     children are exactly those nav-visible pages, in section page order
 *     (Requirement 2.5 — sections with 2+ pages are exposed through a dropdown).
 *
 * Pure: `ia` is not mutated and a fresh `NavModel` is returned.
 *
 * @param ia the Information Architecture (single source of truth)
 * @returns the derived navigation model
 */
export function buildNavModel(ia: IA): NavModel {
  const items: NavItem[] = [];

  // Preserve section order: iterate sections as-authored. (We intentionally do
  // not sort here — the IA's section order is the intended top-level order.)
  for (const section of ia.sections) {
    const navPages = section.pages.filter(isNavVisible);

    // A section with no nav-visible pages contributes no top-level item, keeping
    // the one-to-one correspondence with *nav-visible* sections.
    if (navPages.length === 0) {
      continue;
    }

    if (navPages.length === 1) {
      // Exactly one nav-visible page -> a direct link item.
      const page = navPages[0];
      items.push({
        kind: "link",
        label: section.label,
        pageId: page.id,
        path: page.path,
      });
    } else {
      // Two or more nav-visible pages -> a dropdown menu with those children,
      // preserving the section's page order.
      const children: NavLink[] = navPages.map((page) => ({
        label: page.label,
        pageId: page.id,
        path: page.path,
      }));
      items.push({
        kind: "menu",
        label: section.label,
        sectionId: section.id,
        children,
      });
    }
  }

  return { items };
}

/**
 * Build the Footer Directory model from the Information Architecture.
 *
 * Behavior (Correctness Property 2; Requirements 7.2, 7.3, 7.4, 7.7, 7.8):
 *   - Produces one labeled group per IA section, preserving section order, so
 *     groups correspond one-to-one with the IA sections.
 *   - Each group's label is the section's human-readable `label`, NEVER the
 *     machine `id` (Requirement 7.4 — non-technical, user-friendly labels).
 *   - Each footer-visible page (`showInFooter !== false`) appears exactly once,
 *     in the group of the section that owns it — no missing and no extra pages
 *     (Requirements 7.2, 7.3, 7.7, 7.8).
 *
 * Unlike nav, a section still yields a group even when it currently has no
 * footer-visible pages (an empty-but-labeled group), so the footer reflects the
 * full section structure of the IA. Every group corresponds one-to-one with a
 * section.
 *
 * Pure: `ia` is not mutated and a fresh `FooterDirectory` is returned.
 *
 * @param ia the Information Architecture (single source of truth)
 * @returns the derived footer directory model
 */
export function buildFooterDirectory(ia: IA): FooterDirectory {
  const groups: FooterGroup[] = ia.sections.map((section: Section) => {
    // Each footer-visible page becomes exactly one link, in section page order.
    const links: FooterLink[] = section.pages
      .filter(isFooterVisible)
      .map((page) => ({
        label: page.label,
        pageId: page.id,
        path: page.path,
      }));

    return {
      // Use the human-readable section label, never the machine id.
      label: section.label,
      sectionId: section.id,
      links,
    };
  });

  return { groups };
}

/**
 * Compute the active top-level section for a given current page.
 *
 * This backs the Navigation_Bar's PERSISTENT CURRENT-SECTION INDICATOR
 * (Requirement 1.7): while a Visitor views a page, the top-level nav item for
 * the section that owns that page is marked as the current section. The function
 * returns the OWNING `Section` so the caller can use either its human-readable
 * `label` or its machine `id` (e.g. to match against a `NavItem.sectionId`).
 *
 * Behavior (Correctness Property 5; Requirement 1.7):
 *   - The page is identified either by its unique `PageRef.id` OR by its unique
 *     `PageRef.path` — whichever the caller has on hand (the router works in
 *     terms of paths, while nav/footer models carry page ids). The `by` field
 *     selects which key to match; it defaults to `"id"`.
 *   - Returns the single section whose page list contains a page matching the
 *     given key. Because every page belongs to exactly one section and ids/paths
 *     are unique IA-wide (content-loader integrity checks), at most one section
 *     can match, so the result is unambiguous.
 *   - Returns `undefined` when no page in the IA matches — e.g. a detail page not
 *     represented in the IA, or a path that resolves to a parameterized route
 *     rather than an IA page. Callers render no current-section indicator in that
 *     case.
 *
 * Pure and deterministic: `ia` is not mutated and no DOM/navigation side effects
 * occur, so this is reusable by the NavigationBar component and property-testable
 * in isolation (Correctness Property 5).
 *
 * Design references:
 *   - design.md → Components and Interfaces → Navigation Bar (current-section indicator)
 *   - design.md → Correctness Property 5 (Active-section computation matches the owning section)
 *   - Requirement 1.7
 *
 * @param ia      the Information Architecture (single source of truth)
 * @param current the current page, referenced by its `id` or its `path`
 * @param by      which `PageRef` key `current` refers to — `"id"` (default) or `"path"`
 * @returns the owning `Section`, or `undefined` if no page matches
 */
export function getActiveSection(
  ia: IA,
  current: string,
  by: "id" | "path" = "id",
): Section | undefined {
  // Scan sections in order and return the first (and, by IA uniqueness, only)
  // section that owns a page matching the requested key.
  for (const section of ia.sections) {
    const owns = section.pages.some((page) =>
      by === "path" ? page.path === current : page.id === current,
    );
    if (owns) {
      return section;
    }
  }

  // No page in the IA matches — no current section (e.g. parameterized detail
  // route or unknown page). The caller shows no persistent indicator.
  return undefined;
}
