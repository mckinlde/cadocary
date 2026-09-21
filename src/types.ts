/**
 * Shared TypeScript types for the website redesign.
 *
 * These types are a readable mirror of the JSON Schema (draft 2020-12) documents
 * that validate the authored content (see `src/schema/`). They follow the Data
 * Models in design.md exactly:
 *
 *  - Content entities that overlap with Schema.org use Schema.org-aligned public
 *    field names (`name`, `description`, `image`, `url`, `dateCreated`). These are
 *    the fields emitted as JSON-LD structured data.
 *  - Internal bookkeeping fields (`id`, `slug`, `order`, `detailPageId`, `body`)
 *    are kept for the app's own use and are NOT emitted as structured data.
 *  - The Information Architecture (IA) is genuinely app-specific, so it keeps its
 *    own shape rather than a Schema.org type.
 *
 * Derived models (`NavModel`, `FooterDirectory`, ordered lists, `CarouselState`)
 * are computed from the authored content by pure functions and are never authored
 * directly.
 */

/* =============================================================================
 * Shared content block
 * ========================================================================== */

/**
 * Atomic, reusable content block — the common headless-CMS pattern of composing
 * rich content from small, typed blocks. Used by mission copy and product/project
 * detail bodies.
 */
export type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 2 | 3 | 4; text: string }
  | { type: "image"; src: string; alt: string }
  | { type: "list"; items: string[] };

/* =============================================================================
 * Information Architecture (ia.json) — single source of truth for nav + footer
 * ========================================================================== */

/** A single addressable page within the site. `id` and `path` are unique IA-wide. */
export type PageRef = {
  /** Unique page id across the whole IA. */
  id: string;
  /** Link / menu label. */
  label: string;
  /** Unique URL path, e.g. "/products/atlas". */
  path: string;
  /** Whether the page appears in the navigation bar. Default true. */
  showInNav?: boolean;
  /** Whether the page appears in the footer directory. Default true. */
  showInFooter?: boolean;
};

/** A top-level section that maps to one Navigation_Bar top-level item. */
export type Section = {
  /** Stable machine id, e.g. "products". */
  id: string;
  /** Human-readable, non-technical label, e.g. "What We Offer". */
  label: string;
  /** Display order among top-level items. */
  order: number;
  /** Pages that belong to this section. */
  pages: PageRef[];
};

/** The Information Architecture document. Nav and footer both derive from this. */
export type IA = {
  /** Fallback section id for pages that cannot otherwise be mapped. */
  defaultSectionId: string;
  /** All top-level sections. */
  sections: Section[];
};

/* =============================================================================
 * Products (products.json) — Schema.org Product-aligned
 * ========================================================================== */

export type Product = {
  // --- Schema.org Product-aligned (public / emitted as JSON-LD) ---
  /** schema.org: name. <= 120 chars. */
  name: string;
  /** schema.org: description (was "summary"). <= 300 chars. */
  description: string;
  /** schema.org: image (URL). */
  image?: string;
  /** schema.org: url (canonical URL). */
  url?: string;

  // --- Rich product fields (optional; carried from the live site content) ---
  /** Pricing summary, e.g. "30-day free trial, then $30/month. Cancel anytime.". */
  pricing?: string;
  /** Platform the product runs on, e.g. "Windows desktop". */
  platform?: string;
  /** Data source(s) the product reads from, e.g. "JIS" or ["WA Courts", "JABS"]. */
  sources?: string | string[];
  /** Guided tour steps ("Take the Tour"). */
  tour?: string[];
  /** Frequently asked questions. */
  faq?: { question: string; answer: string }[];
  /** Embedded demo video URL (e.g. a YouTube embed URL). */
  video?: string;
  /** Download URL for the product (e.g. a Google Drive link). */
  download?: string;

  // --- Internal bookkeeping (not emitted as structured data) ---
  /** Stable id. */
  id: string;
  /** URL slug -> detail path /products/{slug}. */
  slug: string;
  /** Stable ordering key. */
  order: number;
  /** References PageRef.id in ia.json. */
  detailPageId: string;
  /** Existing detail content (atomic reusable blocks). */
  body?: ContentBlock[];
};

/* =============================================================================
 * Projects (projects.json) — Schema.org CreativeWork-aligned
 * ========================================================================== */

export type Project = {
  // --- Schema.org CreativeWork-aligned (public / emitted as JSON-LD) ---
  /** schema.org: name (was "title"). <= 120 chars. */
  name: string;
  /** schema.org: description (was "summary"). <= 300 chars. */
  description: string;
  /** schema.org: image (URL). */
  image?: string;
  /** schema.org: url (canonical URL). */
  url?: string;
  /** ISO 8601. schema.org: dateCreated. Recency ordering key (desc); was "addedAt". */
  dateCreated: string;

  // --- Internal bookkeeping (not emitted as structured data) ---
  /** Stable id. */
  id: string;
  /** URL slug -> detail path /projects/{slug}. */
  slug: string;
  /** References PageRef.id in ia.json. */
  detailPageId: string;
  /** Existing detail content (atomic reusable blocks). */
  body?: ContentBlock[];
};

/* =============================================================================
 * Slides (slides.json)
 * ========================================================================== */

export type Slide = {
  id: string;
  image: { src: string; alt: string };
  heading: string;
  text?: string;
  /** Optional call-to-action link. */
  cta?: { label: string; pageId: string; path: string };
};

export type SlideDeck = {
  /** Length 2..10 after validation. */
  slides: Slide[];
  /** Auto-advance interval, 5..8 inclusive. */
  intervalSeconds: number;
};

/* =============================================================================
 * Mission (mission.json)
 * ========================================================================== */

export type Mission = {
  heading: string;
  /** Existing mission and value copy. */
  body: ContentBlock[];
};

/* =============================================================================
 * Derived (non-authored) models — computed from the authored content above
 * ========================================================================== */

/** A direct navigation link (a section with exactly one nav-visible page). */
export type NavLink = { label: string; pageId: string; path: string };

/** A top-level navigation item: either a direct link or a dropdown menu. */
export type NavItem =
  | { kind: "link"; label: string; pageId: string; path: string }
  | { kind: "menu"; label: string; sectionId: string; children: NavLink[] };

/** The navigation model derived from the IA by `buildNavModel`. */
export type NavModel = {
  items: NavItem[];
};

/** A single link within a footer directory group. */
export type FooterLink = { label: string; pageId: string; path: string };

/** A labeled group in the footer directory (one per IA section). */
export type FooterGroup = {
  label: string;
  sectionId: string;
  links: FooterLink[];
};

/** The footer directory model derived from the IA by `buildFooterDirectory`. */
export type FooterDirectory = {
  groups: FooterGroup[];
};

/** Carousel state: exactly one current slide index plus play/pause flag. */
export type CarouselState = {
  current: number;
  playing: boolean;
};

/* =============================================================================
 * JSON-LD (Schema.org structured data emission)
 * ========================================================================== */

/**
 * A Schema.org JSON-LD object. `@context` is always "https://schema.org" and
 * `@type` is the specific Schema.org type (e.g. "Product", "CreativeWork").
 */
export type JsonLd = {
  "@context": "https://schema.org";
  "@type": string;
  [k: string]: unknown;
};
