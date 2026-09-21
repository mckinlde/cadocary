/**
 * JSON Schema (draft 2020-12) — ContentBlock
 *
 * Mirrors the `ContentBlock` union in src/types.ts. A content block is one of
 * four atomic, typed shapes (paragraph | heading | image | list) — the common
 * headless-CMS convention of composing rich content from small reusable blocks.
 * The discriminated union is expressed with `oneOf` + a `const` discriminator on
 * `type`.
 *
 * This schema is referenced (by value) from the Product, Project, and Mission
 * schemas wherever a `ContentBlock[]` body appears.
 */
import { DRAFT_2020_12, type JsonSchema } from "./json-schema";

/**
 * A single content block, WITHOUT the top-level `$schema` declaration so it can
 * be embedded inside other schemas' `items`. Use `contentBlockSchema` for the
 * standalone, `$schema`-bearing document.
 */
export const contentBlockSubschema: JsonSchema = {
  title: "ContentBlock",
  oneOf: [
    {
      title: "ParagraphBlock",
      type: "object",
      properties: {
        type: { const: "paragraph" },
        text: { type: "string" },
      },
      required: ["type", "text"],
      additionalProperties: false,
    },
    {
      title: "HeadingBlock",
      type: "object",
      properties: {
        type: { const: "heading" },
        level: { type: "integer", enum: [2, 3, 4] },
        text: { type: "string" },
      },
      required: ["type", "level", "text"],
      additionalProperties: false,
    },
    {
      title: "ImageBlock",
      type: "object",
      properties: {
        type: { const: "image" },
        src: { type: "string" },
        alt: { type: "string" },
      },
      required: ["type", "src", "alt"],
      additionalProperties: false,
    },
    {
      title: "ListBlock",
      type: "object",
      properties: {
        type: { const: "list" },
        items: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["type", "items"],
      additionalProperties: false,
    },
  ],
};

/** Standalone ContentBlock document declaring the draft 2020-12 dialect. */
export const contentBlockSchema: JsonSchema = {
  $schema: DRAFT_2020_12,
  $id: "content-block.schema.json",
  ...contentBlockSubschema,
};
