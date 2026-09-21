/**
 * JSON Schema (draft 2020-12) — Service_Offering / ServicesPage
 *
 * Mirrors the `ServiceOffering` and `ServicesPage` types in src/types.ts. The
 * Services page is authored as a `services.json` document validated through the
 * existing loader/validator (see design.md → Data Models → Service_Offering).
 *
 * The top-level document is an object `{ offerings: ServiceOffering[] }`, where
 * `offerings` holds 1..20 entries. Each offering carries Schema.org-friendly
 * public copy (`name`, `description`), an optional `caseStudyRef` linking it to
 * a Case_Study as proof, and internal bookkeeping (`id`, `order`).
 *
 * Declared bounds encoded here (design.md → Data Models, Requirements 3.1, 3.2):
 *   - `offerings`   : minItems 1 / maxItems 20
 *   - `name`        : maxLength 120
 *   - `description` : minLength 80 / maxLength 600 (outcome-focused copy)
 *
 * Required offering fields: `name`, `description`, plus the internal keys the app
 * relies on (`id`, `order`). `caseStudyRef` is optional (absent -> no proof link).
 * `additionalProperties: false` is enforced at both levels.
 *
 * The "no standalone best/world-class/cutting-edge" rule is copy guidance
 * enforced by test rather than schema, since a schema cannot cleanly forbid
 * substrings without false positives (see design.md → Testing Strategy).
 */
import { DRAFT_2020_12, type JsonSchema } from "./json-schema";

/** Schema for a single Service_Offering entry. */
export const serviceOfferingSchema: JsonSchema = {
  title: "ServiceOffering",
  type: "object",
  properties: {
    // --- Public copy ---
    name: { type: "string", maxLength: 120 },
    description: { type: "string", minLength: 80, maxLength: 600 },

    // --- Optional proof link ---
    caseStudyRef: { type: "string" },

    // --- Internal bookkeeping (not emitted as structured data) ---
    id: { type: "string" },
    order: { type: "integer" },
  },
  required: ["name", "description", "id", "order"],
  additionalProperties: false,
};

/** Schema for a `services.json` document: `{ offerings: ServiceOffering[] }`. */
export const servicesPageSchema: JsonSchema = {
  $schema: DRAFT_2020_12,
  $id: "services.schema.json",
  title: "ServicesPage",
  type: "object",
  properties: {
    offerings: {
      type: "array",
      items: serviceOfferingSchema,
      minItems: 1,
      maxItems: 20,
    },
  },
  required: ["offerings"],
  additionalProperties: false,
};
