/**
 * Content lint — pure helpers that keep authored copy honest and real.
 *
 * Two concerns are centralized here so they are checkable properties rather
 * than manual review:
 *
 *   1. Banned standalone superlatives (Requirement 3.6): Service_Offering copy
 *      must not use "best", "world-class", or "cutting-edge" as standalone
 *      descriptive claims. Matching is whole-word / whole-term (word-boundary),
 *      so a substring like "cutting board" or "bestseller" does not falsely
 *      trip the lint.
 *   2. Placeholder / empty copy (Requirement 8.5): authored copy must be
 *      non-empty (at least one sentence's worth of real text) and must contain
 *      no placeholder markers such as "Lorem ipsum" or "TODO".
 *
 * Pure and deterministic: no DOM, no mutation of inputs.
 *
 * Design references:
 *   - design.md → Testing Strategy (copy lint enforced by test)
 *   - design.md → Correctness Properties → Properties 19, 20
 */

/** The standalone superlative terms banned from Service_Offering copy. */
export const BANNED_SUPERLATIVES = [
  "best",
  "world-class",
  "cutting-edge",
] as const;

/** Placeholder markers that must never appear in shipped copy. */
export const PLACEHOLDER_MARKERS = ["lorem ipsum", "todo"] as const;

/**
 * Escape a term for safe embedding inside a RegExp source.
 */
function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Return true if `text` contains any banned superlative as a STANDALONE term.
 *
 * "Standalone" means the term is bounded by non-word characters (or string
 * edges) on both sides, so:
 *   - "the best solution"   -> true  ("best" stands alone)
 *   - "bestseller"          -> false (part of a larger word)
 *   - "world-class support" -> true  (the hyphenated term stands alone)
 *   - "a cutting board"     -> false ("cutting" alone is not "cutting-edge")
 *
 * Matching is case-insensitive.
 */
export function containsBannedSuperlative(text: string): boolean {
  for (const term of BANNED_SUPERLATIVES) {
    // (?<![\w-]) / (?![\w-]) treat hyphens as part of the term boundary so
    // "cutting-edge" matches as a whole and "cutting-edger" would not, while
    // "edge" or "cutting" alone never match the hyphenated term.
    const pattern = new RegExp(
      `(?<![\\w-])${escapeRegExp(term)}(?![\\w-])`,
      "i",
    );
    if (pattern.test(text)) return true;
  }
  return false;
}

/**
 * Return true if `text` contains a placeholder marker (e.g. "Lorem ipsum",
 * "TODO"), case-insensitively.
 */
export function containsPlaceholder(text: string): boolean {
  const haystack = text.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => haystack.includes(marker));
}

/**
 * Return true if `text` is real, non-placeholder copy: it has at least one
 * non-whitespace character AND contains no placeholder markers.
 */
export function isRealCopy(text: string): boolean {
  return text.trim().length > 0 && !containsPlaceholder(text);
}
