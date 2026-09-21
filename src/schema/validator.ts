/**
 * =============================================================================
 * Hand-written JSON Schema (draft 2020-12) validator
 * =============================================================================
 *
 * DELIBERATE DECISION: we implement our OWN draft 2020-12 validator here rather
 * than pulling in a third-party JSON Schema library (e.g. Ajv). This is an
 * intentional architectural choice, not an oversight. The rationale:
 *
 *   1. Full control over validation behavior. Our content model only uses a
 *      small, well-understood subset of draft 2020-12 (`type`, `required`,
 *      `properties`, `additionalProperties`, `minLength`/`maxLength`,
 *      `minItems`/`maxItems`, `minimum`/`maximum`, `enum`, `const`, `items`,
 *      `oneOf`, `pattern`). Owning the implementation means the semantics are
 *      exactly what our schemas need — no surprises from broad spec features we
 *      never use, and easy to extend when a schema does.
 *
 *   2. No extra runtime dependency. Validation runs at build/content-load time
 *      and ships nothing to the client. Keeping it dependency-free avoids adding
 *      to the dependency tree and supply-chain surface for a job that is, for our
 *      limited keyword set, small and self-contained.
 *
 *   3. Tailored error messages aligned to our content model. Generic validators
 *      emit generic messages. Our validator produces path-aware errors — a JSON
 *      Pointer plus a readable dotted path to the exact failing field/index and a
 *      message describing precisely why it failed (which keyword, expected vs.
 *      actual). That maps directly onto our authored JSON and makes content
 *      authoring errors obvious.
 *
 * Scope: this validator implements ONLY the keywords listed above — the subset
 * the content schemas in `src/schema/` actually use. It is NOT a complete
 * implementation of the draft 2020-12 specification.
 *
 * Traceability: Requirements 3.3, 3.4, 5.2, 6.2 (bounds enforcement); design.md
 * → Components and Interfaces → Content Loader & Validator, and Error Handling.
 */
import type { JsonSchema } from "./json-schema";

/* =============================================================================
 * Result & error types
 * ========================================================================== */

/**
 * A single validation failure. `path` locates the failing value both as a JSON
 * Pointer (RFC 6901, e.g. `/slides/0/heading`) and as a human-friendly dotted
 * path (e.g. `slides[0].heading`, or `<root>` for the top-level value). `keyword`
 * names the draft 2020-12 keyword that was violated. `message` explains why.
 */
export interface ValidationIssue {
  /** JSON Pointer (RFC 6901) to the failing location, e.g. "/slides/0/heading". */
  pointer: string;
  /** Human-friendly dotted/bracket path, e.g. "slides[0].heading" or "<root>". */
  path: string;
  /** The draft 2020-12 keyword that was violated (e.g. "maxLength", "required"). */
  keyword: string;
  /** Human-readable explanation of the failure. */
  message: string;
}

/**
 * A validation error. Validation can surface more than one problem at once, so
 * every issue found is collected in `issues`. `message` is a compact summary of
 * the first (primary) issue for convenient logging/display.
 */
export interface ValidationError {
  /** Summary message (the primary issue's path + message). */
  message: string;
  /** Every issue discovered during validation. Always at least one entry. */
  issues: ValidationIssue[];
}

/**
 * Discriminated result: either a validated, typed value or a `ValidationError`.
 * Mirrors the `Result<T, E>` interface intent from design.md.
 */
export type Result<T, E = ValidationError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/* =============================================================================
 * Path helpers (JSON Pointer + friendly dotted path)
 * ========================================================================== */

/** Internal path segment: an object key (string) or an array index (number). */
type Segment = string | number;

/** Escape a segment for a JSON Pointer per RFC 6901 (~ -> ~0, / -> ~1). */
function escapePointer(segment: string): string {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

/** Build a JSON Pointer string from path segments. Root is the empty string. */
function toPointer(segments: Segment[]): string {
  if (segments.length === 0) return "";
  return segments
    .map((s) => "/" + escapePointer(String(s)))
    .join("");
}

/** Build a friendly dotted/bracket path. Root renders as "<root>". */
function toFriendlyPath(segments: Segment[]): string {
  if (segments.length === 0) return "<root>";
  let out = "";
  for (const s of segments) {
    if (typeof s === "number") {
      out += `[${s}]`;
    } else if (out === "") {
      out = s;
    } else {
      out += `.${s}`;
    }
  }
  return out;
}

/* =============================================================================
 * Type detection (JSON Schema semantics)
 * ========================================================================== */

type JsonSchemaType =
  | "object"
  | "array"
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "null";

/**
 * Determine the set of JSON Schema types that a runtime value satisfies. Note
 * `integer` is not a distinct JS type — an integer value satisfies both
 * "number" and "integer"; a non-integer number satisfies only "number".
 */
function jsonTypesOf(value: unknown): Set<JsonSchemaType> {
  const types = new Set<JsonSchemaType>();
  if (value === null) {
    types.add("null");
  } else if (Array.isArray(value)) {
    types.add("array");
  } else if (typeof value === "object") {
    types.add("object");
  } else if (typeof value === "string") {
    types.add("string");
  } else if (typeof value === "boolean") {
    types.add("boolean");
  } else if (typeof value === "number") {
    // NaN / Infinity are not valid JSON numbers; treat only finite as number.
    if (Number.isFinite(value)) {
      types.add("number");
      if (Number.isInteger(value)) types.add("integer");
    }
  }
  return types;
}

/** Short human label describing a value's runtime type, for error messages. */
function describeType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  const t = typeof value;
  if (t === "number") {
    if (!Number.isFinite(value as number)) return "non-finite number";
    return Number.isInteger(value as number) ? "integer" : "number";
  }
  return t; // "object" | "string" | "boolean" | "undefined" | ...
}

/** Deep structural equality for JSON values (used by `const` / `enum`). */
function jsonEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((item, i) => jsonEquals(item, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const ak = Object.keys(ao);
    const bk = Object.keys(bo);
    if (ak.length !== bk.length) return false;
    return ak.every(
      (k) => Object.prototype.hasOwnProperty.call(bo, k) && jsonEquals(ao[k], bo[k]),
    );
  }
  return false;
}

/** Render a scalar/JSON value compactly for inclusion in error messages. */
function preview(value: unknown): string {
  if (typeof value === "string") {
    const clipped = value.length > 40 ? `${value.slice(0, 40)}…` : value;
    return JSON.stringify(clipped);
  }
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return String(value);
}

/* =============================================================================
 * Core validation
 * ========================================================================== */

/**
 * Validate `doc` against `schema` (a draft 2020-12 document/subschema).
 *
 * On success, returns `{ ok: true, value }` where `value` is `doc` narrowed to
 * `T` (the validator has confirmed it conforms). On failure, returns
 * `{ ok: false, error }` with every discovered issue, each carrying a JSON
 * Pointer and a friendly path to the exact failing location.
 */
export function validate<T = unknown>(
  doc: unknown,
  schema: JsonSchema,
): Result<T, ValidationError> {
  const issues: ValidationIssue[] = [];
  validateNode(doc, schema, [], issues);

  if (issues.length === 0) {
    return { ok: true, value: doc as T };
  }

  const primary = issues[0]!;
  return {
    ok: false,
    error: {
      message: `${primary.path}: ${primary.message}`,
      issues,
    },
  };
}

/** Push a new issue for the given path segments. */
function addIssue(
  issues: ValidationIssue[],
  segments: Segment[],
  keyword: string,
  message: string,
): void {
  issues.push({
    pointer: toPointer(segments),
    path: toFriendlyPath(segments),
    keyword,
    message,
  });
}

/**
 * Validate a single node against a (sub)schema, appending any issues found.
 * Keyword order is chosen so type is checked first; keywords that depend on a
 * particular runtime type are guarded by that type.
 */
function validateNode(
  value: unknown,
  schema: JsonSchema,
  segments: Segment[],
  issues: ValidationIssue[],
): void {
  // --- oneOf: value must validate against exactly one subschema ---
  if (schema.oneOf !== undefined) {
    validateOneOf(value, schema.oneOf, segments, issues);
    // Fall through: remaining sibling keywords (if any) still apply. Our schemas
    // don't mix oneOf with other constraints on the same node, but this keeps
    // semantics correct if they ever do.
  }

  // --- const ---
  if (schema.const !== undefined) {
    if (!jsonEquals(value, schema.const)) {
      addIssue(
        issues,
        segments,
        "const",
        `must equal ${preview(schema.const)} (got ${preview(value)})`,
      );
      // A const mismatch makes further checks noisy; stop here for this node.
      return;
    }
  }

  // --- enum ---
  if (schema.enum !== undefined) {
    const matched = schema.enum.some((allowed) => jsonEquals(value, allowed));
    if (!matched) {
      const allowed = schema.enum.map((v) => preview(v)).join(", ");
      addIssue(
        issues,
        segments,
        "enum",
        `must be one of [${allowed}] (got ${preview(value)})`,
      );
    }
  }

  // --- type ---
  if (schema.type !== undefined) {
    const actual = jsonTypesOf(value);
    if (!actual.has(schema.type)) {
      addIssue(
        issues,
        segments,
        "type",
        `expected type "${schema.type}" but got ${describeType(value)}`,
      );
      // Without a matching type, type-specific keyword checks below would be
      // meaningless — stop validating this node.
      return;
    }
  }

  // --- string keywords ---
  if (typeof value === "string") {
    validateString(value, schema, segments, issues);
  }

  // --- number keywords ---
  if (typeof value === "number" && Number.isFinite(value)) {
    validateNumber(value, schema, segments, issues);
  }

  // --- array keywords ---
  if (Array.isArray(value)) {
    validateArray(value, schema, segments, issues);
  }

  // --- object keywords ---
  if (isPlainObject(value)) {
    validateObject(value, schema, segments, issues);
  }
}

/** True for a non-null, non-array object. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateString(
  value: string,
  schema: JsonSchema,
  segments: Segment[],
  issues: ValidationIssue[],
): void {
  // Count Unicode code points (draft 2020-12 measures length in code points).
  const length = [...value].length;

  if (schema.minLength !== undefined && length < schema.minLength) {
    addIssue(
      issues,
      segments,
      "minLength",
      `must be at least ${schema.minLength} character(s) long (got ${length})`,
    );
  }
  if (schema.maxLength !== undefined && length > schema.maxLength) {
    addIssue(
      issues,
      segments,
      "maxLength",
      `must be at most ${schema.maxLength} character(s) long (got ${length})`,
    );
  }
  if (schema.pattern !== undefined) {
    let re: RegExp;
    try {
      re = new RegExp(schema.pattern, "u");
    } catch {
      // Fall back to a non-unicode regex if the pattern isn't unicode-valid.
      re = new RegExp(schema.pattern);
    }
    if (!re.test(value)) {
      addIssue(
        issues,
        segments,
        "pattern",
        `must match pattern /${schema.pattern}/ (got ${preview(value)})`,
      );
    }
  }
}

function validateNumber(
  value: number,
  schema: JsonSchema,
  segments: Segment[],
  issues: ValidationIssue[],
): void {
  if (schema.minimum !== undefined && value < schema.minimum) {
    addIssue(
      issues,
      segments,
      "minimum",
      `must be >= ${schema.minimum} (got ${value})`,
    );
  }
  if (schema.maximum !== undefined && value > schema.maximum) {
    addIssue(
      issues,
      segments,
      "maximum",
      `must be <= ${schema.maximum} (got ${value})`,
    );
  }
}

function validateArray(
  value: unknown[],
  schema: JsonSchema,
  segments: Segment[],
  issues: ValidationIssue[],
): void {
  if (schema.minItems !== undefined && value.length < schema.minItems) {
    addIssue(
      issues,
      segments,
      "minItems",
      `must contain at least ${schema.minItems} item(s) (got ${value.length})`,
    );
  }
  if (schema.maxItems !== undefined && value.length > schema.maxItems) {
    addIssue(
      issues,
      segments,
      "maxItems",
      `must contain at most ${schema.maxItems} item(s) (got ${value.length})`,
    );
  }
  if (schema.items !== undefined) {
    value.forEach((item, index) => {
      validateNode(item, schema.items!, [...segments, index], issues);
    });
  }
}

function validateObject(
  value: Record<string, unknown>,
  schema: JsonSchema,
  segments: Segment[],
  issues: ValidationIssue[],
): void {
  // --- required ---
  if (schema.required !== undefined) {
    for (const key of schema.required) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        addIssue(
          issues,
          [...segments, key],
          "required",
          `missing required property "${key}"`,
        );
      }
    }
  }

  // --- properties ---
  if (schema.properties !== undefined) {
    for (const [key, subschema] of Object.entries(schema.properties)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        validateNode(value[key], subschema, [...segments, key], issues);
      }
    }
  }

  // --- additionalProperties ---
  if (schema.additionalProperties !== undefined) {
    const declared = new Set(
      schema.properties ? Object.keys(schema.properties) : [],
    );
    for (const key of Object.keys(value)) {
      if (declared.has(key)) continue;
      if (schema.additionalProperties === false) {
        addIssue(
          issues,
          [...segments, key],
          "additionalProperties",
          `unexpected additional property "${key}"`,
        );
      } else if (typeof schema.additionalProperties === "object") {
        // A schema for additional properties: every extra property must match.
        validateNode(
          value[key],
          schema.additionalProperties,
          [...segments, key],
          issues,
        );
      }
      // additionalProperties === true (or undefined) allows anything.
    }
  }
}

/**
 * `oneOf`: the value must validate against exactly one of the subschemas.
 * Because our `ContentBlock` uses a `const` discriminator on `type`, we surface
 * a tailored message: if exactly one branch's discriminator matched but the
 * branch still failed, we report that branch's own issues (the most useful
 * diagnostics); otherwise we report that no (or multiple) branches matched.
 */
function validateOneOf(
  value: unknown,
  branches: JsonSchema[],
  segments: Segment[],
  issues: ValidationIssue[],
): void {
  const branchIssues: ValidationIssue[][] = [];
  let matchCount = 0;

  for (const branch of branches) {
    const local: ValidationIssue[] = [];
    validateNode(value, branch, segments, local);
    branchIssues.push(local);
    if (local.length === 0) matchCount += 1;
  }

  if (matchCount === 1) return; // exactly one match: valid

  if (matchCount > 1) {
    addIssue(
      issues,
      segments,
      "oneOf",
      `must match exactly one schema but matched ${matchCount}`,
    );
    return;
  }

  // matchCount === 0: try to pick the "closest" branch for a helpful message.
  // Heuristic: a branch whose discriminator (const on a property) matched is the
  // intended one; prefer the branch with the fewest issues otherwise.
  const closest = pickClosestBranch(value, branches, branchIssues);

  if (closest) {
    // Re-emit the closest branch's issues so the author sees the real problem.
    for (const issue of closest.issues) issues.push(issue);
  } else {
    addIssue(
      issues,
      segments,
      "oneOf",
      `does not match any of the ${branches.length} allowed schemas`,
    );
  }
}

/**
 * Choose the most relevant failing branch for a `oneOf` mismatch. Prefers a
 * branch whose `const` discriminator (e.g. `type: { const: "paragraph" }`)
 * matched the value; falls back to the branch that produced the fewest issues.
 */
function pickClosestBranch(
  value: unknown,
  branches: JsonSchema[],
  branchIssues: ValidationIssue[][],
): { issues: ValidationIssue[] } | null {
  // Discriminator match: object value whose discriminator property equals a
  // branch's const on that property.
  if (isPlainObject(value)) {
    for (let i = 0; i < branches.length; i++) {
      const props = branches[i]!.properties;
      if (!props) continue;
      for (const [key, sub] of Object.entries(props)) {
        if (
          sub.const !== undefined &&
          Object.prototype.hasOwnProperty.call(value, key) &&
          jsonEquals(value[key], sub.const)
        ) {
          return { issues: branchIssues[i]! };
        }
      }
    }
  }

  // Fallback: fewest issues (but only if at least one branch produced issues).
  let best: ValidationIssue[] | null = null;
  for (const list of branchIssues) {
    if (list.length === 0) continue;
    if (best === null || list.length < best.length) best = list;
  }
  return best ? { issues: best } : null;
}
