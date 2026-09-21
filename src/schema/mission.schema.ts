/**
 * JSON Schema (draft 2020-12) — Mission
 *
 * Mirrors the `Mission` type in src/types.ts: a `heading` string plus a `body`
 * of one or more ContentBlocks (the existing mission and value copy). Both
 * fields are required.
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
  },
  required: ["heading", "body"],
  additionalProperties: false,
};
