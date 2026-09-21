/**
 * JSON Schema (draft 2020-12) — Product
 *
 * Mirrors the `Product` type in src/types.ts, aligned with Schema.org
 * https://schema.org/Product. Public fields (`name`, `description`, `image`,
 * `url`) are Schema.org-aligned and emitted as JSON-LD; internal bookkeeping
 * fields (`id`, `slug`, `order`, `detailPageId`, `body`) are retained but never
 * emitted as structured data.
 *
 * Declared bounds encoded here (design.md → Data Models, Requirement 5.2):
 *   - `name`        : maxLength 120
 *   - `description` : maxLength 300
 *
 * Required fields: `name`, `description`, plus the internal keys that the app
 * relies on (`id`, `slug`, `order`, `detailPageId`). Optional Schema.org fields
 * (`image`, `url`) and the optional detail `body` are not required.
 *
 * Rich, optional product fields carried from the live Cadocary site content are
 * also accepted (all optional): `pricing`, `platform`, `sources` (a string or a
 * string array), `tour` (string[]), `faq` (array of {question, answer}), `video`
 * (embed URL), and `download` (download URL). These are additive and backward
 * compatible; `additionalProperties: false` is preserved.
 */
import { DRAFT_2020_12, type JsonSchema } from "./json-schema";
import { contentBlockSubschema } from "./content-block.schema";

export const productSchema: JsonSchema = {
  $schema: DRAFT_2020_12,
  $id: "product.schema.json",
  title: "Product",
  type: "object",
  properties: {
    // --- Schema.org Product-aligned (public / emitted as JSON-LD) ---
    name: { type: "string", maxLength: 120 },
    description: { type: "string", maxLength: 300 },
    image: { type: "string" },
    url: { type: "string" },

    // --- Rich product fields (all optional; carried from live site content) ---
    pricing: { type: "string" },
    platform: { type: "string" },
    // `sources` is either a single string or an array of strings.
    sources: {
      oneOf: [
        { type: "string" },
        { type: "array", items: { type: "string" } },
      ],
    },
    tour: {
      type: "array",
      items: { type: "string" },
    },
    faq: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          answer: { type: "string" },
        },
        required: ["question", "answer"],
        additionalProperties: false,
      },
    },
    video: { type: "string" },
    download: { type: "string" },

    // --- Internal bookkeeping (not emitted as structured data) ---
    id: { type: "string" },
    slug: { type: "string" },
    order: { type: "integer" },
    detailPageId: { type: "string" },
    body: {
      type: "array",
      items: contentBlockSubschema,
    },
  },
  required: ["name", "description", "id", "slug", "order", "detailPageId"],
  additionalProperties: false,
};

/** Schema for a `products.json` document: an array of Product objects. */
export const productsSchema: JsonSchema = {
  $schema: DRAFT_2020_12,
  $id: "products.schema.json",
  title: "Products",
  type: "array",
  items: productSchema,
};
