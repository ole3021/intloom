import * as z from "zod";
import {
  specificationArtifactSchema as spec,
  specificationAcceptanceSchema,
} from "./specification-artifact.ts";
import { solutionArtifactSchema as sol } from "./solution-artifact.ts";
const text = z.string().trim().min(1);
export const draftRevisionSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const specificationObject = z.union([
  spec.shape.domains.element,
  spec.shape.features.element,
  spec.shape.requirements.element.omit({ record_refs: true }),
  specificationAcceptanceSchema,
  spec.shape.constraints.element.omit({ record_refs: true }),
  spec.shape.relations.element.omit({ record_refs: true }),
  spec.shape.deferreds.element.omit({ record_refs: true }),
]);
const participant = sol.shape.scenarios.element.shape.participants.element;
const participantFields = participant.omit({ type: true, ref: true });
const editableParticipant = z.discriminatedUnion("type", [
  participantFields.extend({
    type: z.literal("module"),
    ref: z.string().regex(/^OMOD-.+/),
  }),
  participantFields.extend({
    type: z.literal("resource"),
    ref: z.string().regex(/^ORES-.+/),
  }),
  participantFields.extend({ type: z.literal("actor") }),
  participantFields.extend({ type: z.literal("external_system") }),
]);
const solutionObject = z.union([
  sol.shape.structure.shape.apps.element,
  sol.shape.structure.shape.packages.element,
  sol.shape.structure.shape.apps.element.shape.modules.element,
  sol.shape.structure.shape.resources.element,
  sol.shape.structure.shape.relations.element,
  sol.shape.scenarios.element.extend({
    participants: z.array(editableParticipant),
  }),
  sol.shape.concepts.element.omit({ record_refs: true }),
  sol.shape.decisions.element.omit({ record_refs: true }),
  sol.shape.risks.element.omit({ record_refs: true }),
  sol.shape.diagrams.element.omit({ record_refs: true }),
]);
export const specificationEditSchema = z.strictObject({
  draftRevision: draftRevisionSchema,
  edits: z.array(z.strictObject({ value: specificationObject, reason: text })),
  removeAcceptances: z
    .array(
      z.strictObject({ targetRef: z.string().regex(/^SACC-.+/), reason: text }),
    )
    .default([]),
});
export const solutionEditSchema = z.strictObject({
  draftRevision: draftRevisionSchema,
  edits: z.array(z.strictObject({ value: solutionObject, reason: text })),
});
