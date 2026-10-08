import * as z from "zod";
const text = z.string().trim().min(1);
const id = (prefix: string) => z.string().regex(new RegExp(`^${prefix}-.+`));
const refs = z.array(text);
const status = z.enum(["active", "retired"]);
const sources = {
  requirement_refs: refs.optional(),
  constraint_refs: refs.optional(),
};
const history = { record_refs: z.array(id("RUN")) };
const scope = { scope_refs: refs.optional(), ...sources };
const moduleSchema = z.strictObject({
  id: id("OMOD"),
  parent_ref: z.string().regex(/^(OAPP|OPKG)-.+/),
  status,
  name: text,
  description: text,
  ...sources,
  interfaces: z
    .array(
      z.strictObject({
        id: z.string().regex(/^OMOD-.+-INT-.+/),
        name: text,
        type: z.enum(["call", "event"]),
        description: text,
      }),
    )
    .optional(),
});
export const solutionArtifactSchema = z.strictObject({
  structure: z.strictObject({
    apps: z.array(
      z.strictObject({
        id: id("OAPP"),
        name: text,
        type: z.enum(["web", "mobile", "service", "worker"]),
        description: text,
        technologies: z
          .array(
            z.strictObject({
              type: z.enum(["platform", "language", "runtime", "framework"]),
              name: text,
              version: text.optional(),
            }),
          )
          .optional(),
        modules: z.array(moduleSchema),
      }),
    ),
    packages: z.array(
      z.strictObject({
        id: id("OPKG"),
        name: text,
        description: text,
        modules: z.array(moduleSchema).min(1),
      }),
    ),
    resources: z.array(
      z.strictObject({
        id: id("ORES"),
        name: text,
        type: z.enum([
          "database",
          "message_bus",
          "message_queue",
          "event_bus",
          "cache",
          "object_storage",
          "external_service",
          "other",
        ]),
        description: text,
        capabilities: z
          .array(z.strictObject({ name: text, description: text.optional() }))
          .optional(),
        ...sources,
      }),
    ),
    relations: z.array(
      z.strictObject({
        id: id("OREL"),
        source_ref: text,
        target_ref: text,
        type: z.enum([
          "depends_on",
          "calls",
          "uses",
          "reads",
          "writes",
          "publishes",
          "subscribes",
        ]),
        description: text,
        ...sources,
      }),
    ),
  }),
  scenarios: z.array(
    z.strictObject({
      id: id("OSCN"),
      status,
      description: text,
      requirement_refs: refs,
      initial_state: text.optional(),
      participants: z.array(
        z.strictObject({
          id: id("OPAR"),
          ref: text.optional(),
          type: z.enum(["module", "resource", "actor", "external_system"]),
          name: text,
          description: text.optional(),
        }),
      ),
      steps: z.array(
        z.strictObject({
          id: z.string().regex(/^OSCN-.+-STEP-\d+$/),
          source_ref: text,
          target_ref: text.optional(),
          type: z.enum([
            "call",
            "return",
            "event",
            "read",
            "write",
            "start",
            "stop",
            "activity",
          ]),
          action: text,
        }),
      ),
      outcomes: z.array(
        z.strictObject({
          target_ref: text.optional(),
          type: z.enum(["response", "state", "event", "external_effect"]),
          description: text,
        }),
      ),
    }),
  ),
  concepts: z.array(
    z.strictObject({
      id: id("OCON"),
      name: text,
      status,
      definition: text,
      ...scope,
      rules: z.array(
        z.strictObject({
          id: z.string().regex(/^OCON-.+-RULE-\d+$/),
          description: text,
        }),
      ),
      ...history,
    }),
  ),
  decisions: z.array(
    z.strictObject({
      id: id("ODEC"),
      name: text,
      status,
      decision: text,
      reason: text,
      ...scope,
      ...history,
    }),
  ),
  risks: z.array(
    z.strictObject({
      id: id("ORISK"),
      name: text,
      status,
      description: text,
      impact: text,
      mitigation: text.optional(),
      ...scope,
      ...history,
    }),
  ),
  diagrams: z.array(
    z.strictObject({
      id: id("ODIAG"),
      name: text,
      status,
      type: z.enum(["overview", "component", "scenario", "state"]),
      description: text.optional(),
      refs,
      d2_code: text,
      ...history,
    }),
  ),
});
export type SolutionArtifact = z.infer<typeof solutionArtifactSchema>;
export default solutionArtifactSchema;
