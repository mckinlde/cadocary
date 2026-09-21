/**
 * Card view-models — the pure, rendering-relevant derivation behind the
 * Product_Catalog and Project_Showcase card components.
 *
 * The Astro card components (ProductCatalog.astro, ProjectShowcase.astro) render
 * three things per item: the item's `name`, its `description`, and a link to the
 * item's detail page. The detail link is computed as `/products/{slug}` for
 * products and `/projects/{slug}` for projects — the exact parameterized detail
 * routes recognized by `resolveRoute` (see `src/domain/router.ts`).
 *
 * These functions extract that derivation into pure, testable helpers so the
 * "what a card must contain" contract can be property-tested in isolation
 * (Correctness Property 12) without rendering heavyweight Astro components. The
 * card components compute the same `/products/${slug}` / `/projects/${slug}`
 * hrefs, so testing this derivation faithfully covers the card's required
 * fields and its detail link.
 *
 * Traceability: Requirements 5.2 (product card shows name, description, detail
 * link), 6.2 (project card shows name, description, detail link); Correctness
 * Property 12.
 */

import type { Product, Project } from "../types";

/** Route prefix for parameterized product detail routes: `/products/:slug`. */
export const PRODUCT_DETAIL_PREFIX = "/products/";
/** Route prefix for parameterized project detail routes: `/projects/:slug`. */
export const PROJECT_DETAIL_PREFIX = "/projects/";

/**
 * The minimal view-model a card needs to render: the display `name`, the display
 * `description`, and the `href` of the item's detail page. This mirrors exactly
 * what ProductCatalog.astro / ProjectShowcase.astro put on the page.
 */
export type CardViewModel = {
  /** Schema.org-aligned display name shown on the card. */
  name: string;
  /** Schema.org-aligned display description shown on the card. */
  description: string;
  /** Detail-page link target, e.g. "/products/atlas" or "/projects/orbit". */
  href: string;
};

/**
 * Build the card view-model for a product. The detail link points at the
 * parameterized product route `/products/{slug}`.
 */
export function productCard(product: Product): CardViewModel {
  return {
    name: product.name,
    description: product.description,
    href: `${PRODUCT_DETAIL_PREFIX}${product.slug}`,
  };
}

/**
 * Build the card view-model for a project. The detail link points at the
 * parameterized project route `/projects/{slug}`.
 */
export function projectCard(project: Project): CardViewModel {
  return {
    name: project.name,
    description: project.description,
    href: `${PROJECT_DETAIL_PREFIX}${project.slug}`,
  };
}
