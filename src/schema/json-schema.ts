/**
 * =============================================================================
 * JSON Schema (draft 2020-12) document type
 * =============================================================================
 *
 * The content entities are validated against JSON Schema **draft 2020-12**
 * documents. Per the design (design.md → Data Models), the authored schemas
 * each declare `"$schema": "https://json-schema.org/draft/2020-12/schema"` and
 * the TypeScript types in `src/types.ts` are a readable mirror of these schemas.
 *
 * In this project the schema documents are authored as TypeScript modules that
 * export a plain schema object (rather than standalone `.json` files). The shape
 * is identical to the JSON Schema document — same `$schema`, `type`, `required`,
 * `properties`, `maxLength`, `minItems`/`maxItems`, `minimum`/`maximum`, `enum`,
 * `const`, `items`, and `oneOf` keywords. Authoring them in TypeScript lets the
 * hand-written draft 2020-12 validator (task 2.2) import them directly and keeps
 * the whole content model typechecked end to end.
 *
 * `JsonSchema` is intentionally permissive: it captures the draft 2020-12
 * keywords our content model actually uses. It is NOT a full model of the
 * specification — only what these schemas need.
 */

/** The canonical draft 2020-12 dialect identifier used by every schema here. */
export const DRAFT_2020_12 =
  "https://json-schema.org/draft/2020-12/schema" as const;

/** The subset of JSON Schema draft 2020-12 keywords used by our content schemas. */
export interface JsonSchema {
  /** Dialect identifier. Only the root document declares this. */
  $schema?: typeof DRAFT_2020_12;
  /** Document identifier (draft 2020-12 uses `$id`). */
  $id?: string;
  title?: string;
  description?: string;

  /** JSON Schema primitive type(s). */
  type?:
    | "object"
    | "array"
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "null";

  // --- object keywords ---
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;

  // --- array keywords ---
  items?: JsonSchema;
  minItems?: number;
  maxItems?: number;

  // --- string keywords ---
  minLength?: number;
  maxLength?: number;
  pattern?: string;

  // --- number keywords ---
  minimum?: number;
  maximum?: number;

  // --- generic keywords ---
  enum?: ReadonlyArray<string | number | boolean | null>;
  const?: string | number | boolean | null;

  // --- combinators ---
  oneOf?: JsonSchema[];
}
