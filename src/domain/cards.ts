/**
 * Card view-models — the pure, rendering-relevant derivation behind the
 * Product_Catalog, Case_Study_Collection, and Services card components.
 *
 * The Astro card components render a small, fixed contract per item: a heading,
 * a summary, a call-to-action (a detail link), and — where the entity carries
 * one — a resolved image. The detail link is computed as `/products/{slug}` for
 * products and `/work/{slug}` for case studies — the exact parameterized detail
 * routes recognized by `resolveRoute` (see `src/domain/router.ts`).
 *
 * These functions extract that derivation into pure, testable helpers so the
 * "what a card must contain" contract can be property-tested in isolation
 * (Correctness Properties 12, 13, 14) without rendering heavyweight Astro
 * components. The card components compute the same hrefs, so testing this
 * derivation faithfully covers the card's required fields and its detail link.
 *
 * Traceability: Requirements 4.2 (four ordered sections), 4.3 (case-study card
 * shows title, summary, image, detail link), 4.5 (fixed section order), 8.6
 * (every card exposes heading + summary + CTA), 3.7 / 3.8 (Service_Offering
 * proof-link derivation); Correctness Properties 12, 13, 14.
 */

import type {
  CaseStudy,
  CaseStudySection,
  Product,
  ServiceOffering,
} from "../types";
import { resolveImage, type ResolvedImage } from "./images";

/** Route prefix for parameterized product detail routes: `/products/:slug`. */
export const PRODUCT_DETAIL_PREFIX = "/products/";
/** Route prefix for parameterized case-study detail routes: `/work/:slug`. */
export const WORK_DETAIL_PREFIX = "/work/";

/**
 * The minimal view-model a card needs to render: the display `name`, the display
 * `description`, and the `href` of the item's detail page. This mirrors exactly
 * what ProductCatalog.astro puts on the page.
 */
export type CardViewModel = {
  /** Schema.org-aligned display name shown on the card. */
  name: string;
  /** Schema.org-aligned display description shown on the card. */
  description: string;
  /** Detail-page link target, e.g. "/products/atlas" or "/work/orbit". */
  href: string;
};

/**
 * The common card contract every card type satisfies (Requirement 8.6,
 * Correctness Property 13): a non-empty `heading`, a `summary`, and a
 * call-to-action (`cta`) carrying the label and the detail-page href.
 *
 * `productCard`, `caseStudyCard`, and `serviceOfferingCard` all produce a
 * view-model structurally compatible with this shape so a single property can
 * assert "every card exposes heading, summary, and CTA" across all three.
 */
export type CardCommon = {
  /** Non-empty heading shown at the top of the card. */
  heading: string;
  /** Summary/description copy shown on the card. */
  summary: string;
  /** The card's call-to-action. */
  cta: { label: string; href: string };
};

/**
 * Build the card view-model for a product. The detail link points at the
 * parameterized product route `/products/{slug}`.
 *
 * Exposes both the legacy `CardViewModel` fields (`name`, `description`, `href`)
 * and the common `heading`/`summary`/`cta` contract (Requirement 8.6).
 */
export function productCard(product: Product): CardViewModel & CardCommon {
  const href = `${PRODUCT_DETAIL_PREFIX}${product.slug}`;
  return {
    name: product.name,
    description: product.description,
    href,
    heading: product.name,
    summary: product.description,
    cta: { label: "View product", href },
  };
}

/**
 * The card view-model for a Case_Study (Requirement 4.3, Correctness Property
 * 12). It exposes:
 *
 *  - `name` / `heading`: the case-study title (authored `name`, ≤ 120 chars).
 *  - `description` / `summary`: the case-study summary (authored `description`,
 *    ≤ 300 chars).
 *  - `image`: the case study's OWN explicitly associated image resolved via
 *    `resolveImage`, so a missing/blank image collapses to `{ kind: "none" }`
 *    and never renders a broken reference (Requirement 6.5).
 *  - `href` / `cta`: a detail link of exactly `/work/{slug}`.
 *
 * The length bounds are enforced upstream by the case-study schema; this
 * view-model preserves the authored text verbatim.
 */
export type CaseStudyCardViewModel = CardViewModel &
  CardCommon & {
    /** The case study's own resolved image, collapsed to `none` when absent. */
    image: ResolvedImage;
  };

/**
 * Build the card view-model for a Case_Study. The detail link points at the
 * parameterized case-study route `/work/{slug}`, and the image is resolved from
 * the case study's own explicit association (collapsing when none).
 */
export function caseStudyCard(caseStudy: CaseStudy): CaseStudyCardViewModel {
  const href = `${WORK_DETAIL_PREFIX}${caseStudy.slug}`;
  return {
    name: caseStudy.name,
    description: caseStudy.description,
    href,
    heading: caseStudy.name,
    summary: caseStudy.description,
    cta: { label: "Read case study", href },
    image: resolveImage(caseStudy),
  };
}

/** The four Case_Study section kinds, in their fixed presentation order. */
const CASE_STUDY_SECTION_ORDER: ReadonlyArray<CaseStudySection["kind"]> = [
  "problem",
  "approach",
  "whatWasBuilt",
  "outcome",
];

/**
 * Expose a Case_Study's four sections in the fixed order
 * `problem → approach → whatWasBuilt → outcome`, regardless of the order they
 * were authored in (Requirements 4.2, 4.5; Correctness Property 10 support).
 *
 * Each returned section carries its authored `body` verbatim. The case-study
 * schema guarantees each of the four kinds appears exactly once, so this returns
 * exactly four sections; if a kind is somehow missing it is simply omitted
 * rather than fabricated (the schema is the authority on completeness).
 *
 * Pure and deterministic — the input array is not mutated.
 */
export function orderedCaseStudySections(
  caseStudy: CaseStudy,
): CaseStudySection[] {
  const byKind = new Map<CaseStudySection["kind"], CaseStudySection>();
  for (const section of caseStudy.sections) {
    // First authored occurrence of a kind wins; the schema forbids duplicates.
    if (!byKind.has(section.kind)) {
      byKind.set(section.kind, section);
    }
  }

  const ordered: CaseStudySection[] = [];
  for (const kind of CASE_STUDY_SECTION_ORDER) {
    const section = byKind.get(kind);
    if (section) {
      ordered.push(section);
    }
  }
  return ordered;
}

/**
 * The derived view-model for a Service_Offering card (Requirement 8.6;
 * Correctness Properties 13, 14). It always exposes a `name`, a `description`,
 * and a call-to-action, and OPTIONALLY a `proofHref`.
 *
 * `proofHref` is present ONLY when the offering's `caseStudyRef` resolves to an
 * existing Case_Study — in which case it is exactly `/work/{slug}` for that case
 * study. When the ref is absent or does not resolve, `proofHref` is omitted
 * entirely (never an empty or broken href) (Requirements 3.7, 3.8).
 */
export type ServiceOfferingCardViewModel = {
  /** Display name of the service (Schema.org-aligned). */
  name: string;
  /** Outcome-focused description of the service. */
  description: string;
  /** Common card heading (mirrors `name`). */
  heading: string;
  /** Common card summary (mirrors `description`). */
  summary: string;
  /** The card's call-to-action. */
  cta: { label: string; href: string };
  /**
   * A proof link `/work/{slug}` to the evidencing case study — present ONLY when
   * `caseStudyRef` resolves; omitted otherwise (never empty/broken).
   */
  proofHref?: string;
};

/**
 * Build the card view-model for a Service_Offering, deriving its proof link.
 *
 * `caseStudyById` resolves a case-study id/ref to the corresponding Case_Study
 * (or `undefined` when it does not exist). When `offering.caseStudyRef` is a
 * non-empty string that resolves to an existing case study, the offering gains
 * a `proofHref` of exactly `/work/{slug}` for that case study, and the CTA links
 * to it. Otherwise the proof link is omitted and the CTA falls back to the
 * Case_Study_Collection (`/work`) so the card still exposes a call-to-action
 * (Requirement 8.6) without emitting a broken per-offering proof link
 * (Requirements 3.7, 3.8).
 *
 * Pure and deterministic given a pure `caseStudyById`.
 */
export function serviceOfferingCard(
  offering: ServiceOffering,
  caseStudyById: (ref: string) => CaseStudy | undefined,
): ServiceOfferingCardViewModel {
  const base: ServiceOfferingCardViewModel = {
    name: offering.name,
    description: offering.description,
    heading: offering.name,
    summary: offering.description,
    // Default CTA points at the collection so every service card has a CTA even
    // when it has no specific case-study proof link.
    cta: { label: "See our work", href: WORK_DETAIL_PREFIX.replace(/\/$/, "") },
  };

  const ref = offering.caseStudyRef;
  if (typeof ref === "string" && ref !== "") {
    const caseStudy = caseStudyById(ref);
    if (caseStudy) {
      const proofHref = `${WORK_DETAIL_PREFIX}${caseStudy.slug}`;
      return {
        ...base,
        cta: { label: "See the case study", href: proofHref },
        proofHref,
      };
    }
  }

  // Absent or unresolved ref -> no proof link at all (never empty/broken).
  return base;
}
