/**
 * JSON Schema (draft 2020-12) — Mission
 *
 * Mirrors the `Mission` type in src/types.ts: a `heading` string plus a `body`
 * of one or more ContentBlocks (the existing mission and value copy). Both are
 * required.
 *
 * Adds an OPTIONAL `capability` object (the home-page Capability_Statement): a
 * `heading` string plus a `body` of ContentBlocks (reusing the shared
 * ContentBlock subschema). It is optional so it degrades gracefully when absent
 * (design.md → Data Models; Requirements 1.8, 2.6).
 */
import { DRAFT_2020_12, type JsonSchema } from "./json-schema";
import { contentBlockSubschema } from "./content-block.schema";

export const missionSchema: JsonSchema = {
  $schema: DRAFT_2020_12,
  $id: "mission.schema.json",
  title: "Mission",
  type: "object",
  properties: {
    heading: { type: "string" },
    body: {
      type: "array",
      items: contentBlockSubschema,
    },
    // Optional home-page Capability_Statement: heading + ContentBlock[] body.
    capability: {
      type: "object",
      properties: {
        heading: { type: "string" },
        body: {
          type: "array",
          items: contentBlockSubschema,
        },
      },
      required: ["heading", "body"],
      additionalProperties: false,
    },
  },
  required: ["heading", "body"],
  additionalProperties: false,
};
