import type {
  LifecycleStatus,
  SpecificationArtifact,
} from "../../schemas/specification-artifact.ts";

/** Displays the complete candidate validated by review; confirmation authorization remains bound to the original State snapshot. */
export function formatConfirmation(artifact: SpecificationArtifact): string {
  const domains = new Map(
    artifact.domains.map((item) => [item.id, item.responsibility]),
  );
  const features = new Map(
    artifact.features.map((item) => [item.id, item.responsibility]),
  );
  const requirements = new Map(
    artifact.requirements.map((item) => [item.id, item.description]),
  );
  const affected = new Map<string, string>([
    ...features,
    ...requirements,
    ...artifact.constraints.map((item): [string, string] => [
      item.id,
      item.description,
    ]),
  ]);
  const relations = {
    depends_on: "depends on",
    conflicts_with: "conflicts with",
    refines: "refines",
  };
  const sections = [
    section(
      "Domains",
      artifact.domains.map((item) => label(item.responsibility, item.status)),
    ),
    section(
      "Features",
      artifact.features.map(
        (item) =>
          `${label(item.responsibility, item.status)}\nDomain: ${domains.get(item.domain_ref)}`,
      ),
    ),
    section(
      "Requirements",
      artifact.requirements.map(
        (item) =>
          `${label(item.description, item.status)}\nFeature: ${features.get(item.feature_ref)}\nAcceptance criteria: ${
            item.acceptances.length
              ? `\n${item.acceptances.map((acceptance) => `- ${acceptance.description}`).join("\n")}`
              : "Not defined"
          }`,
      ),
    ),
    section(
      "Constraints",
      artifact.constraints.map((item) => label(item.description, item.status)),
    ),
    section(
      "Requirement relations",
      artifact.relations.map(
        (item) =>
          `${label(item.description, item.status)}\nRelation: ${requirements.get(item.source_req_ref)} ${relations[item.type]} ${requirements.get(item.target_req_ref)}`,
      ),
    ),
    section(
      "Deferred items",
      artifact.deferreds.map((item) =>
        [
          label(item.question, item.status),
          `Description: ${item.description}`,
          ...(item.impact === undefined ? [] : [`Impact: ${item.impact}`]),
          ...(item.impact_refs.length
            ? [
                `Related items: ${item.impact_refs.map((ref) => affected.get(ref)).join("; ")}`,
              ]
            : []),
        ].join("\n"),
      ),
    ),
  ].filter(Boolean);
  return [
    "Specification ready to save",
    "The following is the complete specification that will be saved after confirmation. Items marked (retired) are retained as history and are no longer current requirements.",
    ...(sections.length ? sections : ["There are no specification items."]),
  ].join("\n\n");
}

function label(text: string, status: LifecycleStatus): string {
  return status === "retired" ? `${text} (retired)` : text;
}

function section(title: string, items: readonly string[]): string {
  if (!items.length) return "";
  return `${title}\n${items.map((text, index) => `${index + 1}. ${text.replaceAll("\n", "\n   ")}`).join("\n")}`;
}
