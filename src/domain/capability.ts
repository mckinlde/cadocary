/**
 * Capability_Statement analysis — pure helpers for the home-page positioning
 * copy that names Cadocary's concrete capabilities.
 *
 * The Capability_Statement is authored as a `CapabilityStatement` (a heading
 * plus `ContentBlock[]`). The *concrete named capabilities* are the items of
 * the `list` block(s) in its body — each list item names one capability (e.g.
 * "Web platforms", "Native mobile apps", "AI/ML integration"). This module
 * centralizes "how many distinct capabilities does this statement name" so the
 * ≥ 3 rule (Requirement 2.4) is a checkable property rather than a copy accident.
 *
 * Pure and deterministic: no DOM, no mutation of the input.
 *
 * Design references:
 *   - design.md → Data Models → Mission (extended with Capability_Statement)
 *   - design.md → Correctness Properties → Property 7
 */

import type { CapabilityStatement } from "../types";

/**
 * Collect the distinct named capabilities from a Capability_Statement.
 *
 * A named capability is an item of a `list` block in the statement body. Items
 * are trimmed, blank items are ignored, and comparison is case-insensitive so
 * "Automation" and "automation" count once. The returned array preserves the
 * first-seen order of the distinct capability labels.
 *
 * @param capability the Capability_Statement to inspect
 * @returns the distinct capability labels named by its list blocks
 */
export function namedCapabilities(capability: CapabilityStatement): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const block of capability.body) {
    if (block.type !== "list") continue;
    for (const item of block.items) {
      const label = item.trim();
      if (label === "") continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(label);
    }
  }

  return result;
}

/**
 * Count the distinct named capabilities in a Capability_Statement.
 *
 * @param capability the Capability_Statement to inspect
 * @returns the number of distinct capability labels named by its list blocks
 */
export function countCapabilities(capability: CapabilityStatement): number {
  return namedCapabilities(capability).length;
}
