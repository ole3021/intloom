import type { JsonObject } from "../contracts/json.ts";
import { checkOutcome, type OutcomeContract } from "../contracts/outcome.ts";
import { copyJson, freezeJson } from "../schema/json.ts";
import { DefinitionError } from "./errors.ts";
import type { AgentDefinition, CodeDefinition } from "./components.ts";
import type { WorkflowDefinition } from "./workflow.ts";
import type {
  DefinitionIO,
  InputOf,
  NormalizedInputOf,
  OutputOf,
} from "./io.ts";

export type LoomStorage = "global" | "project";

export interface LoomIdentity {
  readonly id: string;
  readonly version: string;
}
export interface InstalledLoomRef extends LoomIdentity {
  readonly artifactDigest: string;
}
export interface LoomRef<I, N, O>
  extends InstalledLoomRef,
    DefinitionIO<I, N, O> {
  readonly kind: "loom_ref";
  readonly contracts: {
    readonly input: JsonObject;
    readonly normalizedInput: JsonObject;
    readonly output: JsonObject;
  };
}
/** A requirement uses a semantic version range; a LoomIdentity identifies an exact release. */
export type LoomDependencyDeclaration = Readonly<
  Record<string, { readonly id: string; readonly version: string }>
>;

export type LoomEntry =
  | (Omit<CodeDefinition, "execute"> & {
      readonly execute: (...args: never[]) => unknown;
    })
  | (Omit<AgentDefinition, "prompt"> & {
      readonly prompt: (...args: never[]) => unknown;
    })
  | WorkflowDefinition;
export interface LoomDefinition<E extends LoomEntry = LoomEntry>
  extends LoomIdentity,
    DefinitionIO<InputOf<E>, NormalizedInputOf<E>, OutputOf<E>> {
  readonly name?: string;
  readonly kind: "loom";
  readonly description: string;
  readonly entry: E;
  readonly storage?: LoomStorage;
  readonly dependencies?: LoomDependencyDeclaration;
  readonly outcome?: OutcomeContract;
}

function checkName(name: string): void {
  if (
    typeof name !== "string" ||
    !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(name)
  )
    throw new DefinitionError(
      "DEFINITION_INVALID",
      "id",
      "Expected a package name or @scope/name.",
    );
}

export function defineLoom<E extends LoomEntry>(
  definition: Omit<LoomDefinition<E>, "kind">,
): LoomDefinition<E> {
  checkName(definition.id);
  if (
    definition.storage !== undefined &&
    !["global", "project"].includes(definition.storage)
  )
    throw new DefinitionError(
      "DEFINITION_INVALID",
      "storage",
      "Expected global or project storage.",
    );
  if (definition.name !== undefined && !definition.name.trim())
    throw new DefinitionError(
      "DEFINITION_INVALID",
      "name",
      "Display name must not be empty.",
    );
  if (
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
      definition.version,
    )
  )
    throw new DefinitionError(
      "DEFINITION_INVALID",
      "version",
      "Expected an exact semantic version.",
    );
  if (
    !definition.entry ||
    !["code", "agent", "workflow"].includes(definition.entry.kind)
  )
    throw new DefinitionError(
      "ENTRY_INVALID",
      "entry",
      "Expected Code, Agent, or a committed Workflow.",
    );
  let outcome: OutcomeContract | undefined;
  if (definition.outcome) {
    checkOutcome(definition.outcome);
    const declared = definition.outcome;
    const snapshot = copyJson(
      {
        ...declared,
        ...(declared.artifacts
          ? {
              artifacts: Object.fromEntries(
                Object.entries(declared.artifacts).map(([slot, artifact]) => [
                  slot,
                  { multiple: false, required: true, ...artifact },
                ]),
              ),
            }
          : {}),
      },
      "outcome",
    );
    freezeJson(snapshot);
    outcome = snapshot as unknown as OutcomeContract;
  }
  return Object.freeze({
    ...definition,
    kind: "loom",
    ...(definition.dependencies
      ? {
          dependencies: Object.freeze(
            Object.fromEntries(
              Object.entries(definition.dependencies).map(([alias, spec]) => [
                alias,
                Object.freeze({ ...spec }),
              ]),
            ),
          ),
        }
      : {}),
    ...(outcome ? { outcome } : {}),
  });
}
