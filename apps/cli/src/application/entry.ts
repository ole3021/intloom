import type { RunSource } from "@intloom/kernel";
export type { RunSource } from "@intloom/kernel";

export interface ProjectEntry {
  readonly source: RunSource;
  readonly ide?: "codex";
}

const entries: Readonly<Record<string, ProjectEntry>> = Object.freeze({
  "/mcp": Object.freeze({ source: "agent_ide" }),
  "/mcp/codex": Object.freeze({ source: "agent_ide", ide: "codex" }),
  "/internal/mcp": Object.freeze({ source: "cli" }),
  "/internal/mcp/studio": Object.freeze({ source: "studio" }),
});

/** Paths bind application identity; neither client names nor model-supplied parameters select an entry. */
export function resolveProjectEntry(path: string): ProjectEntry | undefined {
  return Object.hasOwn(entries, path) ? entries[path] : undefined;
}

export function projectEndpointPath(source: "cli" | "studio"): string {
  return source === "cli" ? "/internal/mcp" : "/internal/mcp/studio";
}
