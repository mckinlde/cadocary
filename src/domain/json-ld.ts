/**
 * Schema.org JSON-LD emission — pure derivation functions.
 *
 * ---------------------------------------------------------------------------
 * Key design decision: ALIGN the content model with Schema.org field names and
 * EMIT JSON-LD structured data.
 * ---------------------------------------------------------------------------
 *
 * Our authored content entities (Product, Case_Study/CreativeWork, Service)
 * already use Schema.org-aligned public field names (`name`, `description`,
 * `image`, `url`). Because the content model is *already*
 * Schema.org-shaped, turning it into `<script type="application/ld+json">`
 * structured data is a THIN DERIVATION — we simply attach `@context`/`@type`
 * and drop the internal bookkeeping fields — rather than a translation layer
 * that would have to remap every field.
 *
 * Rationale / advantages:
 *   - Interoperability: the emitted JSON-LD reads like standard Schema.org data,
 *     so search engines and AI crawlers understand our products, projects,
 *     navigation, and pages out of the box.
 *   - SEO / AI-crawler benefits "for free": we get rich structured data at
 *     render time without maintaining a separate mapping layer that could drift
 *     from the authored content.
 *   - Low maintenance: adding a Schema.org-aligned field to the content model
 *     automatically flows into the structured data with (almost) no extra code.
 *
 * Every emitted object carries `@context: "https://schema.org"`. We emit ONLY
 * the Schema.org-aligned fields (`name`, `description`, `image`, `url`,
 * `dateCreated`) and NEVER the internal fields (`id`, `slug`, `order`,
 * `detailPageId`, `body`). Optional fields (`image`, `url`) are omitted entirely
 * when the authored content does not provide them.
 *
 * Design references:
 *   - design.md → Key Design Decision: Adopt Established Standards for the
 *     Content Model (Schema.org alignment + JSON-LD emission)
 *   - design.md → Components and Interfaces → StructuredData / JSON-LD Emission
 *   - design.md → Correctness Property 14
 *
 * All functions here are pure (authored content in, JSON-LD out) and therefore
 * property-testable.
 */

import type { CaseStudy, JsonLd, NavModel, PageRef, Product, ServiceOffering } from "../types";

/** The Schema.org JSON-LD context used by every emitted object. */
const SCHEMA_ORG_CONTEXT = "https://schema.org" as const;

/**
 * Minimal description of the site as a whole, used to emit a Schema.org WebSite
 * object at the site root. This is genuinely site-level information (not tied to
 * any single content entity), so it gets its own small type here rather than
 * living in the authored content model.
 */
export type SiteInfo = {
  /** schema.org: name — the site/organization name. */
  name: string;
  /** schema.org: url — the canonical site root URL. */
  url: string;
};

/**
 * Derive a Schema.org `Product` JSON-LD object from an authored product.
 *
 * Emits only the Schema.org-aligned fields (`name`, `description`, and
 * optionally `image`/`url`). Internal fields (`id`, `slug`, `order`,
 * `detailPageId`, `body`) are never included. Optional `image`/`url` are omitted
 * when absent on the product.
 *
 * Requirements 5.2, 6.2. Correctness Property 14.
 */
export function toProductJsonLd(product: Product): JsonLd {
  return {
    "@context": SCHEMA_ORG_CONTEXT,
    "@type": "Product",
    name: product.name,
    description: product.description,
    ...optional("image", product.image),
    ...optional("url", product.url),
  };
}

/**
 * Derive a Schema.org `CreativeWork` JSON-LD object from an authored case study.
 *
 * Case studies are the Schema.org-`CreativeWork`-aligned replacement for the
 * deprecated `Project` type. Emits only the public Schema.org fields
 * (`name`, `description`, and optionally `image`/`url`). The case-study `image`
 * is an authored object `{ src, alt }`; Schema.org's `image` expects a URL, so
 * we emit just the `src` string. Unlike projects, case studies carry NO
 * publication date, so `dateCreated` is intentionally NOT emitted.
 *
 * All other case-study fields are internal bookkeeping or case-study-specific
 * copy and are NEVER emitted: `id`, `slug`, `order`, `detailPageId`,
 * `engagementRole`, `deliverable`, `sections`, `proofPoints`, `clientName`,
 * `clientSiteUrl`. Optional `image`/`url` are omitted entirely when absent.
 *
 * Requirements 4.1, 4.3. Correctness Property 21.
 */
export function toCaseStudyJsonLd(caseStudy: CaseStudy): JsonLd {
  return {
    "@context": SCHEMA_ORG_CONTEXT,
    "@type": "CreativeWork",
    name: caseStudy.name,
    description: caseStudy.description,
    ...optional("image", caseStudy.image?.src),
    ...optional("url", caseStudy.url),
  };
}

/**
 * Derive a Schema.org `Service` JSON-LD object from an authored service
 * offering.
 *
 * Emits only the public Schema.org fields (`name` and `description`). Service
 * offerings have no authored `image`/`url`, so none are emitted. Internal
 * bookkeeping fields (`id`, `order`) and the app-internal `caseStudyRef` (used
 * only to derive an in-site proof link) are NEVER emitted.
 *
 * Requirements 4.1, 4.3. Correctness Property 21.
 */
export function toServiceJsonLd(offering: ServiceOffering): JsonLd {
  return {
    "@context": SCHEMA_ORG_CONTEXT,
    "@type": "Service",
    name: offering.name,
    description: offering.description,
  };
}

/**
 * Derive a Schema.org `ItemList` of `SiteNavigationElement` entries from the
 * navigation model — one entry per nav link, in order.
 *
 * The nav model's top-level items are either direct links (`kind: "link"`) or
 * dropdown menus (`kind: "menu"`) whose children are links. Each resulting
 * `SiteNavigationElement` carries only `name` (from the link label) and `url`
 * (from the link path), matching the model's nav links one-to-one.
 *
 * Requirements 5.2, 6.2. Correctness Property 14.
 */
export function toSiteNavigationJsonLd(nav: NavModel): JsonLd {
  const elements: JsonLd[] = [];

  for (const item of nav.items) {
    if (item.kind === "link") {
      elements.push(siteNavigationElement(item.label, item.path));
    } else {
      // A menu contributes one SiteNavigationElement per child link, preserving
      // child order so the emitted list mirrors the nav model exactly.
      for (const child of item.children) {
        elements.push(siteNavigationElement(child.label, child.path));
      }
    }
  }

  return {
    "@context": SCHEMA_ORG_CONTEXT,
    "@type": "ItemList",
    itemListElement: elements,
  };
}

/**
 * Derive a Schema.org `WebPage` JSON-LD object from an IA page reference.
 *
 * Emits the Schema.org-aligned fields: `name` (from the page label) and `url`
 * (from the page path). Internal fields (`id`, `showInNav`, `showInFooter`) are
 * not part of the public structured data.
 *
 * Requirements 5.2, 6.2.
 */
export function toWebPageJsonLd(page: PageRef): JsonLd {
  return {
    "@context": SCHEMA_ORG_CONTEXT,
    "@type": "WebPage",
    name: page.label,
    url: page.path,
  };
}

/**
 * Derive a Schema.org `WebSite` JSON-LD object from site-level info.
 *
 * Emits `name` and `url`. Used at the site root in addition to the per-page
 * `WebPage` object.
 *
 * Requirements 5.2, 6.2.
 */
export function toWebSiteJsonLd(site: SiteInfo): JsonLd {
  return {
    "@context": SCHEMA_ORG_CONTEXT,
    "@type": "WebSite",
    name: site.name,
    url: site.url,
  };
}

/**
 * Serialize a JSON-LD object into a `<script type="application/ld+json">` block
 * suitable for embedding directly in HTML.
 *
 * Security: raw JSON can contain the substring `</script>` (e.g. inside a
 * description), which would prematurely terminate the surrounding script element
 * and open an XSS vector. To emit the JSON safely inside an HTML `<script>`, we
 * escape every `<` as the unicode escape `\u003c`. This is semantically
 * identical JSON (parsers decode `\u003c` back to `<`) but can never form a
 * closing tag or comment sequence in the HTML parser, so the payload is inert.
 *
 * Requirements 5.2, 6.2.
 */
export function renderJsonLdScript(data: JsonLd): string {
  const json = JSON.stringify(data);
  // Escape `<` so that neither `</script>` nor `<!--` can appear literally in
  // the serialized JSON. Replacing just `<` is sufficient to neutralize both.
  const safe = json.replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${safe}</script>`;
}

/* =============================================================================
 * Internal helpers
 * ========================================================================== */

/**
 * Build a single Schema.org `SiteNavigationElement` object carrying only `name`
 * and `url`, matching the shape emitted for each nav link.
 */
function siteNavigationElement(name: string, url: string): JsonLd {
  return {
    "@context": SCHEMA_ORG_CONTEXT,
    "@type": "SiteNavigationElement",
    name,
    url,
  };
}

/**
 * Return `{ [key]: value }` when `value` is defined, or an empty object when it
 * is `undefined`. Spreading the result omits absent optional fields entirely
 * (rather than emitting `"image": undefined`, which would drop from JSON anyway,
 * or an explicit `null`), keeping the structured data clean.
 */
function optional(key: string, value: string | undefined): Record<string, string> {
  return value === undefined ? {} : { [key]: value };
}
