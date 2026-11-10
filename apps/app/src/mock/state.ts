import type {
  ArtifactRecord,
  RunSummary,
  InteractionRequest,
  InteractionResponseRecord,
  RunEvent,
} from "@intloom/loom-sdk";
import type {
  Launch,
  Configuration,
  Deliverable,
  Settings,
} from "../shared/types.ts";
export interface MockRun {
  summary: RunSummary;
  title: string;
  via: "App" | "CLI" | "MCP";
  launch: Launch;
  binding: Configuration;
  steps: string[];
  position: number;
  stage:
    | "work"
    | "outline"
    | "final"
    | "reviewed"
    | "preparing"
    | "delivering"
    | "end";
  nextAt: number | null;
  artifactIssue?: string;
  events: RunEvent[];
  requests: InteractionRequest[];
  answers: InteractionResponseRecord[];
  artifact?: ArtifactRecord;
  candidate?: Deliverable;
  delivered: boolean;
  rejected: boolean;
  outline: string[];
}
export interface MockState {
  schemaVersion: 2;
  service: "online" | "stopping" | "offline";
  runs: MockRun[];
  installed: string[];
  settings: Settings;
}
