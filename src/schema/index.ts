/**
 * Barrel for the JSON Schema (draft 2020-12) documents that validate every
 * content entity. Each entity's schema mirrors the corresponding type in
 * src/types.ts and declares the draft 2020-12 dialect via `$schema`.
 *
 * These are consumed by the hand-written draft 2020-12 validator (task 2.2) and
 * the content loader (task 3.1).
 */
export { DRAFT_2020_12, type JsonSchema } from "./json-schema";
export { contentBlockSchema, contentBlockSubschema } from "./content-block.schema";
export { productSchema, productsSchema } from "./product.schema";
export { serviceOfferingSchema, servicesPageSchema } from "./service.schema";
export { projectSchema, projectsSchema } from "./project.schema";
export {
  caseStudySchema,
  caseStudiesSchema,
  caseStudySectionSchema,
  proofPointSchema,
} from "./case-study.schema";
export { slideSchema, slideDeckSchema } from "./slide-deck.schema";
export { missionSchema } from "./mission.schema";
export { pageRefSchema, sectionSchema, iaSchema } from "./ia.schema";
export {
  validate,
  type Result,
  type ValidationError,
  type ValidationIssue,
} from "./validator";
