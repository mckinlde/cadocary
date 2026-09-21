/**
 * Product and case-study ordering — pure, deterministic ordering functions.
 *
 * These functions are intentionally pure (no DOM, no mutation of their inputs)
 * so that the ordering behavior can be property-tested in isolation and reused
 * by the presentation layer (ProductCatalog / CaseStudyCollection).
 *
 * Design references:
 *   - design.md → Components and Interfaces → Product Catalog & Detail
 *     ("all products in a stable defined order (by explicit `order` field, then id)")
 *   - design.md → Components and Interfaces → Case Study Collection
 *     ("a stable, date-free permutation by `order` then `id`; no publication date")
 *   - design.md → Correctness Properties 10 and 11
 *
 * Both functions return a NEW array (never mutate the input) and are total,
 * deterministic permutations: the output contains exactly the same items as the
 * input (same multiset), just reordered.
 */

import type { CaseStudy, Product } from "../types";

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
 * Return a stable, date-free permutation of `caseStudies` ordered by ascending
 * `order`, with ties broken by ascending `id`.
 *
 * Requirement 4.6 (Case_Study_Collection presents case studies in a stable,
 * defined order with no publication date). Correctness Property 11 (case-study
 * ordering is a date-free stable permutation: same multiset, deterministically
 * ordered by `order` then `id`, using no publication-date field).
 *
 * Case studies deliberately carry NO `dateCreated` field (unlike the deprecated
 * `Project` type), so ordering never depends on a publication date — it is
 * driven solely by the explicit `order` key, with `id` as a deterministic
 * tie-break. The input array is not mutated (we sort a shallow copy).
 *
 * @param caseStudies the authored case studies, in any order
 * @returns a new array with the same case studies ordered by `order` then `id`
 */
export function orderCaseStudies(caseStudies: readonly CaseStudy[]): CaseStudy[] {
  // Copy first so the caller's array is never mutated; Array.prototype.sort
  // sorts in place, so sorting the original would be an observable side effect.
  return [...caseStudies].sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    // Deterministic tie-break by id (ascending) so equal-`order` case studies
    // have a stable, reproducible relative order across runs.
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
