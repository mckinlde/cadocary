/**
 * Route resolution — pure, deterministic mapping from a URL path to what should
 * be rendered for it.
 *
 * This function is the domain-layer core behind the presentation router (design.md
 * → Architecture → Routing and Page Resolution). It is intentionally pure (no DOM,
 * no navigation side effects, no mutation of its inputs) so the resolution rules
 * can be property-tested in isolation and reused by the Astro routing layer
 * (task 15.1) and the 404 page.
 *
 * Resolution rules (design.md → Routing and Page Resolution):
 *   1. Every Page in the IA has a unique `path`. An exact match against an IA
 *      page resolves to that page.
 *   2. Product and project detail pages are resolved either from a dedicated IA
 *      entry (rule 1) or from a parameterized route (`/products/:slug`,
 *      `/projects/:slug`) backed by `products.json` / `projects.json`.
 *   3. Reserved paths (`/search`, `/login`, `/register`) and any unknown path
 *      resolve to a not-found result. Search/login/registration functionality is
 *      never exposed.
 *
 * Precedence: reserved paths are rejected FIRST, before any other matching, so a
 * reserved path can never be shadowed by an (invalid) IA entry or a parameterized
 * route. This directly upholds Correctness Property 13 ("reserved paths resolve to
 * not-found") and Requirement 8.5. The IA itself is guaranteed by content-loader
 * integrity checks to never contain a reserved path, so this is defence in depth.
 *
 * Traceability: Requirements 7.6 (unknown/removed page → not found), 8.5 (reserved
 * paths → not found, never expose search/login/registration); Correctness
 * Property 13.
 */

import type { IA, PageRef, Product, Project } from "../types";
import { RESERVED_PATHS } from "./content-loader";

/* =============================================================================
 * Result type
 * ========================================================================== */

/**
 * The discriminated result of resolving a URL path. Callers switch on `kind`:
 *   - `page`     — an IA page matched the path exactly (render that page).
 *   - `product`  — a parameterized `/products/:slug` route matched a product.
 *   - `project`  — a parameterized `/projects/:slug` route matched a project.
 *   - `not-found`— reserved path or unknown path (render the 404 page).
 *
 * The success variants carry the resolved entity so the caller does not have to
 * look it up again. `not-found` carries a `reason` distinguishing a reserved path
 * from a genuinely unknown one — useful for logging/diagnostics — without ever
 * changing the outcome (both render the same 404).
 */
export type RouteResult =
  | { kind: "page"; page: PageRef }
  | { kind: "product"; product: Product }
  | { kind: "project"; project: Project }
  | { kind: "not-found"; reason: "reserved" | "unknown" };

/* =============================================================================
 * Route prefixes for parameterized detail routes
 * ========================================================================== */

/** Parameterized detail route prefix for products: `/products/:slug`. */
const PRODUCTS_PREFIX = "/products/";
/** Parameterized detail route prefix for projects: `/projects/:slug`. */
const PROJECTS_PREFIX = "/projects/";

/* =============================================================================
 * resolveRoute
 * ========================================================================== */

/**
 * Resolve a URL `path` against the site's Information Architecture and the
 * product/project catalogs.
 *
 * @param path     the requested URL path (e.g. "/products/atlas", "/about")
 * @param ia       the validated Information Architecture (sections + pages)
 * @param products the validated product catalog (backs `/products/:slug`)
 * @param projects the validated project catalog (backs `/projects/:slug`)
 * @returns a discriminated `RouteResult` — a page/product/project on a match, or
 *          `not-found` for reserved and unknown paths.
 */
export function resolveRoute(
  path: string,
  ia: IA,
  products: readonly Product[],
  projects: readonly Project[],
): RouteResult {
  // Normalize the path so trivial input differences (a trailing slash, a query
  // string or fragment, surrounding whitespace) do not accidentally miss a match
  // or, worse, slip a reserved path past the reserved-path check below.
  const normalized = normalizePath(path);

  // --- 1. Reserved paths are rejected FIRST (Requirement 8.5, Property 13). ---
  // Doing this before any matching means search/login/registration can never be
  // exposed, regardless of what else might (invalidly) match.
  if (isReservedPath(normalized)) {
    return { kind: "not-found", reason: "reserved" };
  }

  // --- 2. Exact IA page match (Requirement 7.6). ---
  // Paths are unique across the IA (enforced by content-loader integrity checks),
  // so the first exact match is the only match.
  const page = findPageByPath(ia, normalized);
  if (page !== undefined) {
    return { kind: "page", page };
  }

  // --- 3. Parameterized product detail route `/products/:slug`. ---
  const productSlug = extractSlug(normalized, PRODUCTS_PREFIX);
  if (productSlug !== undefined) {
    const product = products.find((p) => p.slug === productSlug);
    if (product !== undefined) {
      return { kind: "product", product };
    }
    // A `/products/<unknown>` path is a genuine miss, not a reserved path.
    return { kind: "not-found", reason: "unknown" };
  }

  // --- 4. Parameterized project detail route `/projects/:slug`. ---
  const projectSlug = extractSlug(normalized, PROJECTS_PREFIX);
  if (projectSlug !== undefined) {
    const project = projects.find((p) => p.slug === projectSlug);
    if (project !== undefined) {
      return { kind: "project", project };
    }
    return { kind: "not-found", reason: "unknown" };
  }

  // --- 5. Anything else is unknown (Requirement 7.6). ---
  return { kind: "not-found", reason: "unknown" };
}

/* =============================================================================
 * Internal helpers
 * ========================================================================== */

/**
 * Normalize a raw URL path to the canonical form used for matching:
 *   - trim surrounding whitespace,
 *   - drop any query string (`?…`) or fragment (`#…`),
 *   - strip a single trailing slash (except for the root "/").
 *
 * This is deliberately conservative: it does not decode percent-escapes or alter
 * casing, so authored IA paths are matched literally.
 */
function normalizePath(path: string): string {
  let p = path.trim();

  // Strip query string / fragment — they are not part of the routable path.
  const queryIndex = p.search(/[?#]/);
  if (queryIndex !== -1) {
    p = p.slice(0, queryIndex);
  }

  // Strip a single trailing slash, but keep the root path "/" intact.
  if (p.length > 1 && p.endsWith("/")) {
    p = p.slice(0, -1);
  }

  return p;
}

/**
 * Whether `path` is one of the reserved paths (`/search`, `/login`, `/register`).
 * Reuses `RESERVED_PATHS` from the content loader so there is a single source of
 * truth for what "reserved" means across validation and routing.
 */
function isReservedPath(path: string): boolean {
  return RESERVED_PATHS.includes(path);
}

/** Find the IA page whose `path` exactly equals `path`, if any. */
function findPageByPath(ia: IA, path: string): PageRef | undefined {
  for (const section of ia.sections) {
    for (const page of section.pages) {
      if (page.path === path) {
        return page;
      }
    }
  }
  return undefined;
}

/**
 * If `path` is under `prefix` (e.g. "/products/"), return the non-empty slug that
 * follows it; otherwise return `undefined`. A slug containing a further "/" (a
 * nested path) or an empty slug (the bare prefix) is treated as no match, so only
 * genuine single-segment detail routes are recognized.
 */
function extractSlug(path: string, prefix: string): string | undefined {
  if (!path.startsWith(prefix)) {
    return undefined;
  }
  const slug = path.slice(prefix.length);
  if (slug.length === 0 || slug.includes("/")) {
    return undefined;
  }
  return slug;
}
