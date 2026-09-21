/**
 * =============================================================================
 * Content Loader & IA integrity checks
 * =============================================================================
 *
 * `loadContent` is the single entry point that turns a set of raw JSON content
 * documents into a fully validated, typed `ContentBundle` that the rest of the
 * domain and presentation layers can trust. It does two things:
 *
 *   1. Per-document schema validation. Each document (IA, products, case
 *      studies, services, slide deck, mission) is run through our OWN
 *      hand-written draft 2020-12
 *      validator (see `src/schema/validator.ts`, task 2.2) against its schema.
 *
 *   2. Cross-document IA integrity checks, enforced HERE in code rather than in
 *      the JSON Schema. These invariants require reasoning across the whole IA
 *      document and so cannot be expressed as single-field schema keywords
 *      (design.md → Data Models → IA constraints; task 2.1 explicitly defers
 *      them to this task):
 *        - `PageRef.id` is unique across the whole IA.
 *        - `PageRef.path` is unique across the whole IA.
 *        - Each page belongs to exactly one section (a corollary of id
 *          uniqueness — a duplicated id would place a page in two sections).
 *        - `defaultSectionId` references an existing section.
 *        - No `path` equals a reserved path (`/search`, `/login`, `/register`).
 *
 * Error strategy (design.md → Error Handling → Content Loading & Validation):
 *   - In DEVELOPMENT the loader FAILS LOUDLY: `loadContent` throws a
 *     `ContentLoadError` so a build/test surfaces the problem immediately.
 *   - In PRODUCTION the loader is quiet: it returns `{ ok: false, error }` with a
 *     structured `ContentError` so the caller can render its defined fallback
 *     (empty-state / placeholder) rather than crashing the page.
 *
 * Traceability: Requirements 2.2 (each page in exactly one section), 2.6
 * (default section fallback references a real section), 8.5 (reserved paths
 * never present in the IA).
 */

import {
  validate,
  iaSchema,
  productsSchema,
  caseStudiesSchema,
  servicesPageSchema,
  slideDeckSchema,
  missionSchema,
  type Result,
  type ValidationError,
  type ValidationIssue,
} from "../schema";
import type {
  IA,
  Product,
  CaseStudy,
  ServicesPage,
  SlideDeck,
  Mission,
} from "../types";

/* =============================================================================
 * Public types
 * ========================================================================== */

/**
 * The set of raw (unvalidated) JSON documents that make up the site's content.
 * Values are `unknown` because they have not yet passed validation — that is
 * exactly what `loadContent` does. This shape lets the caller obtain the raw
 * documents however it likes (bundled imports, `fetch`, filesystem reads) and
 * hand them to the loader.
 */
export interface ContentSource {
  ia: unknown;
  products: unknown;
  caseStudies: unknown;
  services: unknown;
  slideDeck: unknown;
  mission: unknown;
}

/**
 * A fully validated content bundle. Every field has passed both schema
 * validation and (for the IA) the cross-document integrity checks, so downstream
 * code can consume it without re-checking.
 */
export interface ContentBundle {
  ia: IA;
  products: Product[];
  caseStudies: CaseStudy[];
  services: ServicesPage;
  slideDeck: SlideDeck;
  mission: Mission;
}

/** Which content document a failure relates to (or the IA integrity phase). */
export type ContentErrorSource =
  | "ia"
  | "products"
  | "caseStudies"
  | "services"
  | "slideDeck"
  | "mission"
  | "ia-integrity";

/** The kind of failure: a schema violation or an IA integrity violation. */
export type ContentErrorKind = "schema" | "integrity";

/**
 * A structured content error surfaced for production fallback handling. It names
 * the offending document (`source`), the failure `kind`, a summary `message`,
 * and every individual `issue` (each with a path and explanation) so a caller
 * can log precisely what went wrong while still rendering a graceful fallback.
 */
export interface ContentError {
  source: ContentErrorSource;
  kind: ContentErrorKind;
  message: string;
  issues: ValidationIssue[];
}

/**
 * Thrown when `loadContent` fails in development (fail-loud mode). Carries the
 * same structured `ContentError` so callers/tests can inspect the cause.
 */
export class ContentLoadError extends Error {
  readonly contentError: ContentError;
  constructor(contentError: ContentError) {
    super(contentError.message);
    this.name = "ContentLoadError";
    this.contentError = contentError;
  }
}

/** URL paths that must never appear in the IA (search / login / registration). */
export const RESERVED_PATHS: readonly string[] = ["/search", "/login", "/register"];

/* =============================================================================
 * Options
 * ========================================================================== */

export interface LoadContentOptions {
  /**
   * When true, a failure throws `ContentLoadError` (fail loud) instead of
   * returning `{ ok: false }`. Defaults to "development-like" environments.
   */
  failLoud?: boolean;
}

/**
 * Decide whether we are in a fail-loud (development) context. We treat anything
 * that is not explicitly `production` as development. This reads
 * `import.meta.env.PROD` (Astro/Vite) when available and falls back to
 * `process.env.NODE_ENV`, so it works both in the Astro build and in Node/Vitest.
 */
function isDevelopmentEnv(): boolean {
  // Astro/Vite expose PROD/DEV on import.meta.env.
  const metaEnv = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  if (metaEnv && typeof metaEnv.PROD === "boolean") {
    return metaEnv.PROD !== true;
  }
  // Node / test environments. Access `process` via `globalThis` so this compiles
  // without @types/node (Astro projects don't necessarily include node types).
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process;
  const nodeEnv = proc?.env?.NODE_ENV;
  return nodeEnv !== "production";
}

/* =============================================================================
 * loadContent
 * ========================================================================== */

/**
 * Load, validate, and integrity-check the site content.
 *
 * @param source  the raw JSON documents (unvalidated)
 * @param options optional overrides (e.g. force `failLoud`)
 * @returns `{ ok: true, value: ContentBundle }` on success, or
 *          `{ ok: false, error: ContentError }` in production on failure.
 * @throws  `ContentLoadError` in development (fail-loud) on any failure.
 */
export function loadContent(
  source: ContentSource,
  options: LoadContentOptions = {},
): Result<ContentBundle, ContentError> {
  const failLoud = options.failLoud ?? isDevelopmentEnv();

  // --- 1. Per-document schema validation -----------------------------------
  const ia = validateDoc<IA>(source.ia, iaSchema, "ia");
  if (!ia.ok) return fail(ia.error, failLoud);

  const products = validateDoc<Product[]>(
    source.products,
    productsSchema,
    "products",
  );
  if (!products.ok) return fail(products.error, failLoud);

  const caseStudies = validateDoc<CaseStudy[]>(
    source.caseStudies,
    caseStudiesSchema,
    "caseStudies",
  );
  if (!caseStudies.ok) return fail(caseStudies.error, failLoud);

  const services = validateDoc<ServicesPage>(
    source.services,
    servicesPageSchema,
    "services",
  );
  if (!services.ok) return fail(services.error, failLoud);

  const slideDeck = validateDoc<SlideDeck>(
    source.slideDeck,
    slideDeckSchema,
    "slideDeck",
  );
  if (!slideDeck.ok) return fail(slideDeck.error, failLoud);

  const mission = validateDoc<Mission>(source.mission, missionSchema, "mission");
  if (!mission.ok) return fail(mission.error, failLoud);

  // --- 2. Cross-document IA integrity checks --------------------------------
  const integrity = checkIaIntegrity(ia.value);
  if (!integrity.ok) return fail(integrity.error, failLoud);

  return {
    ok: true,
    value: {
      ia: ia.value,
      products: products.value,
      caseStudies: caseStudies.value,
      services: services.value,
      slideDeck: slideDeck.value,
      mission: mission.value,
    },
  };
}

/* =============================================================================
 * Internal helpers
 * ========================================================================== */

/**
 * Validate a single document against its schema and, on failure, wrap the
 * `ValidationError` into a `ContentError` tagged with the document `source`.
 */
function validateDoc<T>(
  doc: unknown,
  schema: Parameters<typeof validate>[1],
  source: ContentErrorSource,
): Result<T, ContentError> {
  const result = validate<T>(doc, schema);
  if (result.ok) return { ok: true, value: result.value };
  return { ok: false, error: fromValidationError(result.error, source) };
}

/** Convert a schema `ValidationError` into a tagged `ContentError`. */
function fromValidationError(
  error: ValidationError,
  source: ContentErrorSource,
): ContentError {
  return {
    source,
    kind: "schema",
    message: `[${source}] ${error.message}`,
    issues: error.issues,
  };
}

/**
 * Terminate a load with a failure. In development this throws (fail loud); in
 * production it returns the structured error for fallback handling.
 */
function fail(
  error: ContentError,
  failLoud: boolean,
): Result<ContentBundle, ContentError> {
  if (failLoud) {
    throw new ContentLoadError(error);
  }
  return { ok: false, error };
}

/**
 * Enforce the cross-document IA constraints that the JSON Schema deliberately
 * does not (they require whole-document reasoning). Collects every violation so
 * an author sees all problems at once, then returns them as a single
 * `ia-integrity` `ContentError`.
 *
 * Requirements: 2.2 (each page in exactly one section — enforced via id
 * uniqueness), 2.6 (`defaultSectionId` references an existing section), 8.5 (no
 * reserved path present in the IA).
 */
export function checkIaIntegrity(ia: IA): Result<IA, ContentError> {
  const issues: ValidationIssue[] = [];

  // Track first-seen location of each id/path so duplicates can point at both.
  const idFirstSeen = new Map<string, string>();
  const pathFirstSeen = new Map<string, string>();
  const sectionIds = new Set<string>();

  ia.sections.forEach((section, si) => {
    sectionIds.add(section.id);

    section.pages.forEach((page, pi) => {
      const pointer = `/sections/${si}/pages/${pi}`;
      const friendly = `sections[${si}].pages[${pi}]`;

      // --- unique PageRef.id across the whole IA (and, by extension, each page
      //     belongs to exactly one section) ---
      const prevIdAt = idFirstSeen.get(page.id);
      if (prevIdAt !== undefined) {
        issues.push({
          pointer: `${pointer}/id`,
          path: `${friendly}.id`,
          keyword: "uniquePageId",
          message: `duplicate page id "${page.id}" (already defined at ${prevIdAt}); every page id must be unique across the IA and belong to exactly one section`,
        });
      } else {
        idFirstSeen.set(page.id, `${friendly}.id`);
      }

      // --- unique PageRef.path across the whole IA ---
      const prevPathAt = pathFirstSeen.get(page.path);
      if (prevPathAt !== undefined) {
        issues.push({
          pointer: `${pointer}/path`,
          path: `${friendly}.path`,
          keyword: "uniquePath",
          message: `duplicate path "${page.path}" (already defined at ${prevPathAt}); every page path must be unique across the IA`,
        });
      } else {
        pathFirstSeen.set(page.path, `${friendly}.path`);
      }

      // --- reserved-path exclusion ---
      if (RESERVED_PATHS.includes(page.path)) {
        issues.push({
          pointer: `${pointer}/path`,
          path: `${friendly}.path`,
          keyword: "reservedPath",
          message: `path "${page.path}" is reserved and must never appear in the IA (reserved: ${RESERVED_PATHS.join(", ")})`,
        });
      }
    });
  });

  // --- defaultSectionId references an existing section ---
  if (!sectionIds.has(ia.defaultSectionId)) {
    issues.push({
      pointer: "/defaultSectionId",
      path: "defaultSectionId",
      keyword: "defaultSectionRef",
      message: `defaultSectionId "${ia.defaultSectionId}" does not reference any existing section`,
    });
  }

  if (issues.length === 0) {
    return { ok: true, value: ia };
  }

  const primary = issues[0]!;
  return {
    ok: false,
    error: {
      source: "ia-integrity",
      kind: "integrity",
      message: `[ia-integrity] ${primary.path}: ${primary.message}`,
      issues,
    },
  };
}
