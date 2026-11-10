import { checkId, DefinitionError } from "./errors.ts";

export interface ResourceRef<Id extends string = string> {
  readonly kind: "resource";
  readonly id: Id;
  readonly path: string;
  readonly packagePath?: string;
}

export function resource<const Id extends string>(definition: {
  readonly id: Id;
  readonly path: string;
}): ResourceRef<Id> {
  checkId(definition.id);
  if (
    !definition.path ||
    definition.path.startsWith("/") ||
    /^[A-Za-z]:/.test(definition.path) ||
    definition.path.includes("\\") ||
    definition.path
      .split("/")
      .some((part) => !part || part === "." || part === "..")
  ) {
    throw new DefinitionError(
      "DEFINITION_INVALID",
      `resource.${definition.id}.path`,
      "Expected a package-relative POSIX file path without parent segments.",
    );
  }
  return Object.freeze({ ...definition, kind: "resource" });
}

export interface SkillDefinition<Id extends string = string> {
  readonly kind: "skill";
  readonly id: Id;
  readonly description: string;
  readonly instructions: ResourceRef;
  readonly resources?: readonly ResourceRef[];
}
export function defineSkill<
  const Id extends string,
  const Instructions extends ResourceRef,
  const Resources extends readonly ResourceRef[] = readonly [],
>(
  definition: Omit<
    SkillDefinition<Id>,
    "kind" | "instructions" | "resources"
  > & { readonly instructions: Instructions; readonly resources?: Resources },
): SkillDefinition<Id> & {
  readonly instructions: Instructions;
  readonly resources?: Resources;
} {
  checkId(definition.id);
  return Object.freeze({
    ...definition,
    kind: "skill",
    ...(definition.resources
      ? {
          resources: Object.freeze([
            ...definition.resources,
          ]) as unknown as Resources,
        }
      : {}),
  });
}
