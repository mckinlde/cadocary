/**
 * JSON Schema (draft 2020-12) — SlideDeck (and its Slide items)
 *
 * Mirrors the `SlideDeck` / `Slide` types in src/types.ts.
 *
 * Declared bounds encoded here (design.md → Data Models, Requirements 3.3, 3.4):
 *   - `slides`          : minItems 2, maxItems 10   (2..10 slides inclusive)
 *   - `intervalSeconds` : minimum 5, maximum 8      (5..8 seconds inclusive)
 *
 * A Slide has a required image ({ src, alt }) and heading, an optional `text`,
 * and an optional call-to-action `cta` ({ label, pageId, path }).
 */
import { DRAFT_2020_12, type JsonSchema } from "./json-schema";

/** Schema for a single Slide within the deck. */
export const slideSchema: JsonSchema = {
  title: "Slide",
  type: "object",
  properties: {
    id: { type: "string" },
    image: {
      type: "object",
      properties: {
        src: { type: "string" },
        alt: { type: "string" },
      },
      required: ["src", "alt"],
      additionalProperties: false,
    },
    heading: { type: "string" },
    text: { type: "string" },
    cta: {
      type: "object",
      properties: {
        label: { type: "string" },
        pageId: { type: "string" },
        path: { type: "string" },
      },
      required: ["label", "pageId", "path"],
      additionalProperties: false,
    },
  },
  required: ["id", "image", "heading"],
  additionalProperties: false,
};

/** Schema for a `slides.json` document: the SlideDeck. */
export const slideDeckSchema: JsonSchema = {
  $schema: DRAFT_2020_12,
  $id: "slide-deck.schema.json",
  title: "SlideDeck",
  type: "object",
  properties: {
    // 2..10 slides inclusive (Requirement 3.3).
    slides: {
      type: "array",
      items: slideSchema,
      minItems: 2,
      maxItems: 10,
    },
    // 5..8 seconds inclusive (Requirement 3.4).
    intervalSeconds: {
      type: "integer",
      minimum: 5,
      maximum: 8,
    },
  },
  required: ["slides", "intervalSeconds"],
  additionalProperties: false,
};
