export { runCmd as runCli, type CliIo } from "./cmd/index.ts";
export {
  addLoom,
  removeLoom,
  listInstalledLooms,
  type InstalledLoomList,
} from "./core/loom-packages.ts";
export {
  doctorProject,
  type ProjectDoctorResult,
} from "./core/project/doctor.ts";
export {
  startProjectHost,
  type ProjectHost,
  type StartHostOptions,
} from "@intloom/kernel/host";
export {
  startService,
  stopService,
  type StopServiceResult,
} from "@intloom/kernel/host";
export {
  connectProject,
  serviceStatus,
  discoverProjectConnection,
} from "./client/project-client.ts";
export { handlePendingAction } from "@intloom/kernel/transport/interaction";
export type {
  ActionPresenter,
  Presentation,
  AnswerAsk,
} from "@intloom/kernel/transport/interaction";
export {
  actionForm,
  type ActionForm,
} from "@intloom/kernel/transport/interaction";
export { codexConfiguration } from "./ide/codex/config.ts";
export type {
  ArtifactQuery,
  ArtifactSelector,
  ArtifactSummary,
} from "@intloom/kernel/operations";
export { connectProjectClient } from "./client/mcp-client.ts";
export type {
  ProjectClient,
  ProjectConnection,
  ProjectClientOptions,
} from "./client/contracts.ts";
export type { RunSource } from "@intloom/kernel/operations";
export type {
  StoredRecord,
  StoredArtifact,
  ListPage,
  ReadonlyJsonValue,
} from "@intloom/loom-sdk";
export type {
  RunView,
  PendingUserAction,
  RunErrorView,
  LoomView,
} from "@intloom/kernel";
export {
  createCliCore,
  type CliCore,
  type CoreResult,
  type CoreMeta,
  type ServiceRunView,
  type ProjectEvent,
  type ObserveOptions,
  type WaitRunInput,
  type WaitRunResult,
  type ProjectInput,
  type RunInput,
  type StartRunInput,
  type AnswerInput,
  type BuildInput,
  type BuildResult,
} from "./core/index.ts";
