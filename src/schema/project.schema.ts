/**
 * JSON Schema (draft 2020-12) — Project
 *
 * Mirrors the `Project` type in src/types.ts, modeled as Schema.org
 * https://schema.org/CreativeWork. Public fields (`name`, `description`,
 * `image`, `url`, `dateCreated`) are Schema.org-aligned and emitted as JSON-LD;
 * internal bookkeeping fields (`id`, `slug`, `detailPageId`, `body`) are
 * retained but never emitted as structured data.
 *
 * Declared bounds encoded here (design.md → Data Models, Requirement 6.2):
 *   - `name`        : maxLength 120
 *   - `description` : maxLength 300
 *
 * `dateCreated` is an ISO 8601 date/time string (the recency ordering key) and
 * is required. Cross-document ordering behavior lives in the domain layer, not
 * here — this schema only constrains the shape and bounds of a single Project.
 *
 * Required fields: `name`, `description`, `dateCreated`, plus the internal keys
 * `id`, `slug`, `detailPageId`. Optional Schema.org fields (`image`, `url`) and
 * the optional detail `body` are not required.
 */
import { DRAFT_2020_12, type JsonSchema } from "./json-schema";
import { contentBlockSubschema } from "./content-block.schema";

export const projectSchema: JsonSchema = {
  $schema: DRAFT_2020_12,
  $id: "project.schema.json",
  title: "Project",
  type: "object",
  properties: {
    // --- Schema.org CreativeWork-aligned (public / emitted as JSON-LD) ---
    name: { type: "string", maxLength: 120 },
    description: { type: "string", maxLength: 300 },
    image: { type: "string" },
    url: { type: "string" },
    // ISO 8601 date/time; a lenient pattern requiring at least YYYY-MM-DD.
    dateCreated: {
      type: "string",
      pattern: "^\\d{4}-\\d{2}-\\d{2}(T.*)?$",
    },

    // --- Internal bookkeeping (not emitted as structured data) ---
    id: { type: "string" },
    slug: { type: "string" },
    detailPageId: { type: "string" },
    body: {
      type: "array",
      items: contentBlockSubschema,
    },
  },
  required: [
    "name",
    "description",
    "dateCreated",
    "id",
    "slug",
    "detailPageId",
  ],
  additionalProperties: false,
};

/** Schema for a `projects.json` document: an array of Project objects. */
export const projectsSchema: JsonSchema = {
  $schema: DRAFT_2020_12,
  $id: "projects.schema.json",
  title: "Projects",
  type: "array",
  items: projectSchema,
};
