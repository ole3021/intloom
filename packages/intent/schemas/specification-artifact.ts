import * as z from "zod";

export const runIdSchema = z.templateLiteral([
  "RUN-",
  z.string().refine((value) => value.trim().length > 0, "Must not be blank"),
]);
export const domainIdSchema = z.templateLiteral(["SDOM-", z.string()]);
export const featureIdSchema = z.templateLiteral(["SFEA-", z.string()]);
export const requirementIdSchema = z.templateLiteral(["SREQ-", z.string()]);
export const acceptanceIdSchema = z.templateLiteral(["SACC-", z.string()]);
export const constraintIdSchema = z.templateLiteral(["SCON-", z.string()]);
export const relationIdSchema = z.templateLiteral(["SREL-", z.string()]);
export const deferredIdSchema = z.templateLiteral(["SDEF-", z.string()]);

export const specificationObjectIdSchema = z.union([
  domainIdSchema,
  featureIdSchema,
  requirementIdSchema,
  acceptanceIdSchema,
  constraintIdSchema,
  relationIdSchema,
  deferredIdSchema,
]);

export const lifecycleStatusSchema = z.enum(["active", "retired"]);

export const specificationAcceptanceSchema = z.strictObject({
  id: acceptanceIdSchema,
  requirement_ref: requirementIdSchema,
  description: z
    .string()
    .refine((value) => value.trim().length > 0, "Must not be blank"),
});

/** Preserves existing serialized fields; business Code checks ID uniqueness, reference existence, and ownership. */
export const specificationArtifactSchema = z.strictObject({
  domains: z.array(
    z.strictObject({
      id: domainIdSchema,
      responsibility: z
        .string()
        .refine((value) => value.trim().length > 0, "Must not be blank"),
      status: lifecycleStatusSchema,
    }),
  ),
  features: z.array(
    z.strictObject({
      id: featureIdSchema,
      responsibility: z
        .string()
        .refine((value) => value.trim().length > 0, "Must not be blank"),
      status: lifecycleStatusSchema,
      domain_ref: domainIdSchema,
    }),
  ),
  requirements: z.array(
    z.strictObject({
      id: requirementIdSchema,
      status: lifecycleStatusSchema,
      description: z
        .string()
        .refine((value) => value.trim().length > 0, "Must not be blank"),
      acceptances: z.array(specificationAcceptanceSchema),
      feature_ref: featureIdSchema,
      record_refs: z.array(runIdSchema),
    }),
  ),
  constraints: z.array(
    z.strictObject({
      id: constraintIdSchema,
      status: lifecycleStatusSchema,
      description: z
        .string()
        .refine((value) => value.trim().length > 0, "Must not be blank"),
      record_refs: z.array(runIdSchema),
    }),
  ),
  relations: z.array(
    z.strictObject({
      id: relationIdSchema,
      status: lifecycleStatusSchema,
      source_req_ref: requirementIdSchema,
      target_req_ref: requirementIdSchema,
      type: z.enum(["depends_on", "conflicts_with", "refines"]),
      description: z
        .string()
        .refine((value) => value.trim().length > 0, "Must not be blank"),
      record_refs: z.array(runIdSchema),
    }),
  ),
  deferreds: z.array(
    z.strictObject({
      id: deferredIdSchema,
      status: lifecycleStatusSchema,
      question: z
        .string()
        .refine((value) => value.trim().length > 0, "Must not be blank"),
      description: z
        .string()
        .refine((value) => value.trim().length > 0, "Must not be blank"),
      impact: z
        .string()
        .refine((value) => value.trim().length > 0, "Must not be blank")
        .optional(),
      impact_refs: z.array(
        z.union([featureIdSchema, requirementIdSchema, constraintIdSchema]),
      ),
      record_refs: z.array(runIdSchema),
    }),
  ),
});

export type DomainId = z.infer<typeof domainIdSchema>;
export type FeatureId = z.infer<typeof featureIdSchema>;
export type RequirementId = z.infer<typeof requirementIdSchema>;
export type AcceptanceId = z.infer<typeof acceptanceIdSchema>;
export type ConstraintId = z.infer<typeof constraintIdSchema>;
export type RelationId = z.infer<typeof relationIdSchema>;
export type DeferredId = z.infer<typeof deferredIdSchema>;
export type SpecificationObjectId = z.infer<typeof specificationObjectIdSchema>;
export type LifecycleStatus = z.infer<typeof lifecycleStatusSchema>;
export type SpecificationAcceptance = z.infer<
  typeof specificationAcceptanceSchema
>;
export type SpecificationArtifact = z.infer<typeof specificationArtifactSchema>;

export default specificationArtifactSchema;
