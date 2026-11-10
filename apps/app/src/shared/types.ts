import type {
  ArtifactRecord,
  InputFileRef,
  AcceptanceRecord,
  JsonObject,
  JsonValue,
  InstalledLoomRef,
  InteractionRequest,
  InteractionResponseRecord,
  RunControlReceipt,
  InteractionReceipt,
  RunActivityView,
  Page,
  RunEvent,
  RunSummary,
} from "@intloom/loom-sdk";
export type {
  RunActivityView,
  RunEvent,
  RunStatus,
  RunControlReceipt,
} from "@intloom/loom-sdk";

export type SchemaField = {
  type: "string" | "integer" | "boolean" | "array";
  title: string;
  format?: "files" | "file" | "directory" | "pairs";
  minLength?: number;
  minItems?: number;
  maxItems?: number;
  items?:
    | { type: "string"; pattern?: string }
    | {
        type: "object";
        properties: Record<string, { type: "string" }>;
        required: string[];
        additionalProperties: false;
      };
  default?: string | number | boolean;
  minimum?: number;
  maximum?: number;
};
export interface Command {
  textOrFile?: true;
  jsonSchema?: JsonObject;
  name: string;
  title: string;
  description: string;
  output: string;
  input: {
    type: "object";
    properties: Record<string, SchemaField>;
    required: string[];
    additionalProperties?: false;
  };
}
export interface LoomInstallPreview {
  spec: string;
  sourceLabel: string;
  id: string;
  name: string;
  description: string;
  version: string;
  artifactDigest: string;
  integrity: string;
  installed?: "same" | "changed" | "incomplete";
  installedVersion?: string;
}
export interface PackageInfo {
  ref: InstalledLoomRef;
  name: string;
  description: string;
  format: string;
  defaultCommand: string;
  commands: Command[];
}
export type Input = Record<
  string,
  | string
  | number
  | boolean
  | string[]
  | InputFileRef[]
  | { raw: string; edited: string }[]
>;
export interface Launch {
  loom: string;
  command: string;
  input: Input;
  projectDir: string;
  profileId: string;
  finalConfirmation: boolean;
}
export interface Model {
  id: string;
  name: string;
  provider: string;
  model: string;
  credentialId: string;
}
export interface Credential {
  id: string;
  name: string;
  env: string;
}
export interface Harness {
  availability?: "ready" | "missing";
  id: string;
  name: string;
  adapter: string;
}
export interface Profile {
  id: string;
  name: string;
  modelId: string;
  planningModelId: string;
  harnessId: string;
}
export interface Settings {
  models: Model[];
  credentials: Credential[];
  harnesses: Harness[];
  profiles: Profile[];
  globalProfile: string;
  projects: Record<string, string>;
  theme: "system" | "light" | "dark";
  reduceMotion: boolean;
  notifications: boolean;
}
export interface Binding {
  provider: string;
  model: string;
  credentialRef: string;
}
export interface Configuration {
  startupIssue?: string;
  profile: string;
  source: string;
  harness: string;
  adapter: string;
  planner: Binding;
  reviewer: Binding;
}
export interface Deliverable
  extends Pick<
    ArtifactRecord,
    "id" | "runId" | "name" | "mediaType" | "createdAt"
  > {
  format: "pptx" | "zip" | "md" | "json";
  version: 1;
}
export interface RunListItem {
  summary: RunSummary;
  title: string;
  via?: "App" | "CLI" | "MCP";
  statusLabel: string;
  message: string;
  pending: Pick<InteractionRequest, "id" | "kind" | "createdAt" | "message">[];
}
export interface RunDetail extends RunListItem {
  retryLoom: string;
  launch?: Launch;
  binding?: Configuration;
  output?: JsonValue;
  acceptance?: AcceptanceRecord;
  files?: { record: ArtifactRecord; delivered: boolean }[];
  activity: RunActivityView;
  events: RunEvent[];
  answers: InteractionResponseRecord[];
  candidate?: Deliverable;
  artifactIssue?: string;
  delivered: boolean;
  children: RunListItem[];
  reviews: {
    request: InteractionRequest;
    title: string;
    candidate?: Pick<ArtifactRecord, "id" | "runId" | "name">;
  }[];
  durations: {
    workMs: number;
    waitMs: number;
    since: string;
    ticking: "work" | "wait" | "stopped";
  };
}
export interface Snapshot {
  catalog: PackageInfo[];
  mock?: { projects: string[]; files: Record<string, string[]> };
  connection?: {
    version?: string;
    syncedAt?: string;
    issue?: string;
    npmRoot?: string;
    mcpUrl?: string;
    config: string;
  };

  service: "online" | "stopping" | "offline";
  runs: RunListItem[];
  installed: string[];
  settings: Settings;
}
export interface RunQuery {
  query?: string;
  status?: string;
  loom?: string;
  limit?: number;
  cursor?: string;
}
export type ResourceEdit =
  | { kind: "models"; value: Model }
  | { kind: "credentials"; value: Credential }
  | { kind: "harnesses"; value: Harness }
  | { kind: "profiles"; value: Profile };
export type SettingsChange =
  | { type: "saveResource"; resource: ResourceEdit }
  | {
      type: "preferences";
      patch: Partial<
        Pick<
          Settings,
          "theme" | "reduceMotion" | "notifications" | "globalProfile"
        >
      >;
    }
  | { type: "projectDefault"; project: string; profileId: string };
export interface ActionResult {
  createdId?: string;
  issue?: string;
  receipt?: RunControlReceipt;
  interaction?: InteractionReceipt;
}
export type Action =
  | { type: "launch"; draft: Launch; jsonInput?: JsonObject }
  | {
      type: "answer";
      requestId: string;
      value: boolean | string;
    }
  | {
      type: "resume";
      id: string;
      waitId: string;
      requestId?: string;
      resumeData?: JsonValue;
    }
  | { type: "cancel"; id: string; simulateLost?: boolean }
  | { type: "verifyStop"; id?: string }
  | { type: "service"; online: boolean; simulateLost?: boolean }
  | { type: "catalog"; id: string; install: boolean; integrity?: string }
  | SettingsChange;
export interface DesktopApi {
  previewLoom(source: string): Promise<LoomInstallPreview[]>;
  configuration?(
    projectDir?: string,
  ): Promise<import("@intloom/cli/local-service").ConfigurationSummary>;
  snapshot(): Promise<
    Snapshot & { update: import("./updates.ts").StudioUpdate }
  >;
  update(command: import("./updates.ts").UpdateCommand): Promise<void>;
  listRuns(query: RunQuery): Promise<Page<RunListItem>>;
  getRun(id: string): Promise<RunDetail | null>;
  act(action: Action): Promise<ActionResult>;
  pick(kind: "files" | "directory" | "file"): Promise<string[]>;
  artifact(runId: string, mode: "open" | "export"): Promise<string>;
  subscribe(callback: () => void): () => void;
}
export const fileName = (p: string) =>
  p.replaceAll("\\", "/").split("/").filter(Boolean).at(-1) ?? p;
