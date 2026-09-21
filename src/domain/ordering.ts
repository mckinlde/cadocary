/**
 * Product and project ordering — pure, deterministic ordering functions.
 *
 * These functions are intentionally pure (no DOM, no mutation of their inputs)
 * so that the ordering behavior can be property-tested in isolation and reused
 * by the presentation layer (ProductCatalog / ProjectShowcase).
 *
 * Design references:
 *   - design.md → Components and Interfaces → Product Catalog & Detail
 *     ("all products in a stable defined order (by explicit `order` field, then id)")
 *   - design.md → Components and Interfaces → Project Showcase & Detail
 *     ("ordered most-recently-added first (by `dateCreated` descending, tie-broken by id)")
 *   - design.md → Correctness Properties 10 and 11
 *
 * Both functions return a NEW array (never mutate the input) and are total,
 * deterministic permutations: the output contains exactly the same items as the
 * input (same multiset), just reordered.
 */

import type { Product, Project } from "../types";

/**
 * Return a stable permutation of `products` ordered by ascending `order`, with
 * ties broken by ascending `id`.
 *
 * Requirement 5.1 (Product_Catalog presents all products in a stable, defined
 * order). Correctness Property 10 (product ordering is a stable permutation
 * containing the same multiset, deterministically ordered by `order` then `id`).
 *
 * The input array is not mutated (we sort a shallow copy). The `id` tie-break
 * makes the result fully deterministic even when two products share an `order`.
 *
 * @param products the authored products, in any order
 * @returns a new array with the same products ordered by `order` then `id`
 */
export function orderProducts(products: readonly Product[]): Product[] {
  // Copy first so the caller's array is never mutated; Array.prototype.sort
  // sorts in place, so sorting the original would be an observable side effect.
  return [...products].sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    // Deterministic tie-break by id so equal-`order` products have a stable,
    // reproducible relative order across runs.
    return compareIds(a.id, b.id);
  });
}

/**
 * Return a recency permutation of `projects` ordered by `dateCreated`
 * descending (most-recently-added first), with ties broken by ascending `id`.
 *
 * Requirement 6.1 (Project_Showcase presents all projects most-recently-added
 * first). Correctness Property 11 (project ordering is a recency permutation:
 * for every adjacent pair the earlier one has a `dateCreated` >= the later one,
 * ties broken deterministically by `id`).
 *
 * The input array is not mutated. `dateCreated` is an ISO 8601 string; ISO 8601
 * timestamps sort chronologically under lexicographic string comparison, so we
 * compare the strings directly rather than constructing Date objects (which
 * avoids ambiguity around invalid dates producing NaN comparisons).
 *
 * @param projects the authored projects, in any order
 * @returns a new array with the same projects ordered by `dateCreated` desc then `id` asc
 */
export function orderProjects(projects: readonly Project[]): Project[] {
  return [...projects].sort((a, b) => {
    if (a.dateCreated !== b.dateCreated) {
      // Descending: the later dateCreated should come first. Comparing b to a
      // (rather than a to b) yields descending order.
      return compareStrings(b.dateCreated, a.dateCreated);
    }
    // Deterministic tie-break by id (ascending) so same-date projects have a
    // stable, reproducible relative order.
    return compareIds(a.id, b.id);
  });
}

/**
 * Compare two ids for a deterministic ascending tie-break. Ids are strings, so
 * we use a locale-independent lexicographic comparison for reproducibility.
 */
function compareIds(a: string, b: string): number {
  return compareStrings(a, b);
}

/**
 * Locale-independent lexicographic string comparison returning a negative,
 * zero, or positive number. Kept as a small helper so ordering is consistent
 * and does not depend on the host locale (unlike `String.prototype.localeCompare`).
 */
function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
