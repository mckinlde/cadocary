/**
 * JSON Schema (draft 2020-12) — SlideDeck (and its Slide items)
 *
 * Mirrors the `SlideDeck` / `Slide` types in src/types.ts.
 *
 * Declared bounds encoded here (design.md → Data Models, Requirements 3.3, 3.4,
 * 6.2, 6.5, 1.8):
 *   - `slides`          : minItems 2, maxItems 10   (2..10 slides inclusive)
 *   - `intervalSeconds` : minimum 5, maximum 8      (5..8 seconds inclusive)
 *
 * A Slide has a required `heading`, an OPTIONAL image association, an optional
 * reference (`ref`) to the Product/Case_Study it illustrates, an optional `text`,
 * and an optional call-to-action `cta` ({ label, pageId, path }).
 *
 * The `image` field is optional so a slide's image space can collapse gracefully
 * when absent (Requirement 6.5); when present it is an object { src, alt } with
 * alt 1..125 chars naming the specific subject (Requirement 6.4/6.2). The
 * optional `ref` lets a slide resolve its image from the referenced entity's own
 * explicit image, enforcing image-content correspondence (Requirement 6.2).
 */
import { DRAFT_2020_12, type JsonSchema } from "./json-schema";

/** Schema for a single Slide within the deck. */
export const slideSchema: JsonSchema = {
  title: "Slide",
  type: "object",
  properties: {
    id: { type: "string" },
    // Optional explicit image association. When present -> { src, alt } with
    // alt 1..125 chars. When absent -> the image space collapses gracefully.
    image: {
      type: "object",
      properties: {
        src: { type: "string" },
        alt: { type: "string", minLength: 1, maxLength: 125 },
      },
      required: ["src", "alt"],
      additionalProperties: false,
    },
    // Optional reference to the Product/Case_Study this slide illustrates; the
    // render layer resolves the image from that entity when `image` is absent.
    ref: { type: "string" },
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
  required: ["id", "heading"],
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
