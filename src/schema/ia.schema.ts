/**
 * JSON Schema (draft 2020-12) — Information Architecture (ia.json)
 *
 * Mirrors the `IA` / `Section` / `PageRef` types in src/types.ts. The IA is the
 * single source of truth for sections and pages; nav and footer both derive
 * from it.
 *
 * What this schema enforces (constraints expressible in JSON Schema):
 *   - Required fields for `IA` (`defaultSectionId`, `sections`), `Section`
 *     (`id`, `label`, `order`, `pages`), and `PageRef` (`id`, `label`, `path`).
 *   - `PageRef.path` matches a URL-path string pattern: must begin with "/".
 *   - `showInNav` / `showInFooter` are optional booleans (default true in code).
 *
 * What this schema deliberately does NOT enforce (per task 2.1): the
 * cross-document IA constraints — `PageRef.id` uniqueness, `path` uniqueness,
 * each page in exactly one section, `defaultSectionId` referencing an existing
 * section, and reserved-path (`/search`, `/login`, `/register`) exclusion — are
 * enforced by domain-level validation in task 3.1, because they require
 * reasoning across the whole document rather than a single field/value.
 */
import { DRAFT_2020_12, type JsonSchema } from "./json-schema";

/** A single page reference within a section. */
export const pageRefSchema: JsonSchema = {
  title: "PageRef",
  type: "object",
  properties: {
    id: { type: "string" },
    label: { type: "string" },
    // URL path must begin with "/", e.g. "/products/atlas".
    path: { type: "string", pattern: "^/" },
    showInNav: { type: "boolean" },
    showInFooter: { type: "boolean" },
  },
  required: ["id", "label", "path"],
  additionalProperties: false,
};

/** A top-level section that maps to one Navigation_Bar top-level item. */
export const sectionSchema: JsonSchema = {
  title: "Section",
  type: "object",
  properties: {
    id: { type: "string" },
    label: { type: "string" },
    order: { type: "integer" },
    pages: {
      type: "array",
      items: pageRefSchema,
    },
  },
  required: ["id", "label", "order", "pages"],
  additionalProperties: false,
};

/** Schema for the `ia.json` document. */
export const iaSchema: JsonSchema = {
  $schema: DRAFT_2020_12,
  $id: "ia.schema.json",
  title: "IA",
  type: "object",
  properties: {
    defaultSectionId: { type: "string" },
    sections: {
      type: "array",
      items: sectionSchema,
    },
  },
  required: ["defaultSectionId", "sections"],
  additionalProperties: false,
};
