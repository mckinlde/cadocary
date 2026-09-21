/**
 * JSON Schema (draft 2020-12) — Case_Study
 *
 * Mirrors the `CaseStudy` type in src/types.ts, modeled as Schema.org
 * https://schema.org/CreativeWork. Public fields (`name`, `description`,
 * `image`, `url`) are Schema.org-aligned and emitted as JSON-LD; the
 * case-study-specific fields (`clientName`, `clientSiteUrl`, `engagementRole`,
 * `deliverable`, `sections`, `proofPoints`) and internal bookkeeping fields
 * (`id`, `slug`, `order`, `detailPageId`) are retained but never emitted as
 * structured data.
 *
 * Declared bounds encoded here (design.md → Data Models, Requirements 4.2, 4.3,
 * 6.4):
 *   - `name`        : maxLength 120
 *   - `description` : maxLength 300
 *   - `image.alt`   : minLength 1, maxLength 125 (when `image` is present)
 *   - `sections`    : exactly the four fixed section kinds — minItems 4 /
 *                     maxItems 4 with each item constrained to
 *                     kind ∈ {problem, approach, whatWasBuilt, outcome}.
 *
 * The draft-2020-12 subset supported here can encode the section item shape and
 * the four-element cardinality, but NOT "each of the four kinds exactly once"
 * (that would require per-item uniqueness/tuple keywords outside this subset).
 * The exactly-once-per-kind invariant is verified by a domain/property test.
 *
 * `clientSiteUrl`, `engagementRole`, and `deliverable` are required strings.
 * Optional `proofPoints` carry a required `attribution` enum (`client` |
 * `cadocary`) — client-published metrics are attributed to the client.
 *
 * Required fields: `name`, `description`, `clientName`, `clientSiteUrl`,
 * `engagementRole`, `deliverable`, `sections`, plus the internal keys
 * `id`, `slug`, `order`, `detailPageId`. Optional Schema.org fields (`image`,
 * `url`) and the optional `proofPoints` are not required.
 */
import { DRAFT_2020_12, type JsonSchema } from "./json-schema";
import { contentBlockSubschema } from "./content-block.schema";

/** Schema for a single Case_Study section ({ kind, body }). */
export const caseStudySectionSchema: JsonSchema = {
  title: "CaseStudySection",
  type: "object",
  properties: {
    kind: {
      type: "string",
      enum: ["problem", "approach", "whatWasBuilt", "outcome"],
    },
    body: {
      type: "array",
      items: contentBlockSubschema,
    },
  },
  required: ["kind", "body"],
  additionalProperties: false,
};

/** Schema for a single outcome/proof point ({ label, detail?, attribution }). */
export const proofPointSchema: JsonSchema = {
  title: "ProofPoint",
  type: "object",
  properties: {
    label: { type: "string" },
    detail: { type: "string" },
    attribution: {
      type: "string",
      enum: ["client", "cadocary"],
    },
  },
  required: ["label", "attribution"],
  additionalProperties: false,
};

export const caseStudySchema: JsonSchema = {
  $schema: DRAFT_2020_12,
  $id: "case-study.schema.json",
  title: "CaseStudy",
  type: "object",
  properties: {
    // --- Schema.org CreativeWork-aligned (public / emitted as JSON-LD) ---
    name: { type: "string", maxLength: 120 },
    description: { type: "string", maxLength: 300 },
    // Explicitly associated asset; alt is 1..125 chars naming the subject.
    image: {
      type: "object",
      properties: {
        src: { type: "string" },
        alt: { type: "string", minLength: 1, maxLength: 125 },
      },
      required: ["src", "alt"],
      additionalProperties: false,
    },
    url: { type: "string" },

    // --- Case-study-specific fields ---
    clientName: { type: "string" },
    // Live client site to link OUT to (a URL string).
    clientSiteUrl: { type: "string" },
    engagementRole: { type: "string" },
    deliverable: { type: "string" },
    // The four structured sections. The draft-2020-12 subset encodes the item
    // shape + four-element cardinality; the "each kind exactly once" invariant
    // is checked by a domain/property test.
    sections: {
      type: "array",
      items: caseStudySectionSchema,
      minItems: 4,
      maxItems: 4,
    },
    proofPoints: {
      type: "array",
      items: proofPointSchema,
    },

    // --- Internal bookkeeping (not emitted as structured data) ---
    id: { type: "string" },
    slug: { type: "string" },
    order: { type: "integer" },
    detailPageId: { type: "string" },
  },
  required: [
    "name",
    "description",
    "clientName",
    "clientSiteUrl",
    "engagementRole",
    "deliverable",
    "sections",
    "id",
    "slug",
    "order",
    "detailPageId",
  ],
  additionalProperties: false,
};

/** Schema for a `caseStudies.json` document: an array of Case_Study objects. */
export const caseStudiesSchema: JsonSchema = {
  $schema: DRAFT_2020_12,
  $id: "case-studies.schema.json",
  title: "CaseStudies",
  type: "array",
  items: caseStudySchema,
};
