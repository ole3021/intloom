import type { ListPage, StoredArtifact } from "@intloom/kernel";
import type {
  ArtifactQuery,
  ArtifactSummary,
} from "../application/artifacts.ts";

function argument(value: string) {
  return /^[A-Za-z0-9_.:-]+$/u.test(value)
    ? value
    : `'${value.replaceAll("'", "'\\''")}'`;
}
export function artifactListCommand(
  query: ArtifactQuery,
  projectRoot?: string,
) {
  return [
    "intloom artifacts",
    ...(query.flowName === undefined
      ? []
      : [`--flow ${argument(query.flowName)}`]),
    ...(query.stageName === undefined
      ? []
      : [`--stage ${argument(query.stageName)}`]),
    ...(query.limit === undefined ? [] : [`--limit ${query.limit}`]),
    ...(query.cursor === undefined
      ? []
      : [`--cursor ${argument(query.cursor)}`]),
    ...(projectRoot === undefined
      ? []
      : [`--project ${argument(projectRoot)}`]),
  ].join(" ");
}
function artifactCommand(id: string, projectRoot?: string) {
  return `intloom artifact ${argument(id)}${projectRoot === undefined ? "" : ` --project ${argument(projectRoot)}`}`;
}
export function renderArtifacts(
  page: ListPage<ArtifactSummary>,
  query: ArtifactQuery = {},
  projectRoot?: string,
) {
  return [
    "Current committed artifacts at query time",
    ...page.data.flatMap((artifact) => [
      `${artifact.id} · ${artifact.flowName} / ${artifact.stageName} · revision ${artifact.revision}`,
      `Updated ${artifact.updatedAt}`,
      `View ${artifactCommand(artifact.id, projectRoot)}`,
    ]),
    ...(page.data.length ? [] : ["Committed Artifact not found."]),
    ...(page.nextCursor
      ? [
          `Next page ${artifactListCommand({ ...query, cursor: page.nextCursor }, projectRoot)}`,
        ]
      : []),
  ].join("\n");
}
export function renderArtifact(
  artifact: StoredArtifact | null,
  projectRoot?: string,
) {
  if (artifact === null) return "Committed Artifact not found.";
  return [
    `${artifact.id} · ${artifact.flowName} / ${artifact.stageName} · revision ${artifact.revision}`,
    `Created ${artifact.createdAt}\nUpdated ${artifact.updatedAt}`,
    JSON.stringify(artifact.data, null, 2),
    `Export ${artifactCommand(artifact.id, projectRoot)} --output ./artifact.json`,
  ].join("\n");
}
