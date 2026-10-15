export { runCli, type CliIo } from "./commands/program.ts";
export {
  addLoom,
  removeLoom,
  listInstalledLooms,
  type InstalledLoomList,
} from "./looms/manage.ts";
export { doctorProject, type ProjectDoctorResult } from "./commands/doctor.ts";
export {
  startProjectHost,
  type ProjectHost,
  type StartHostOptions,
} from "./service/host.ts";
export {
  startService,
  stopService,
  type StopServiceResult,
} from "./service/lifecycle.ts";
export {
  connectProject,
  serviceStatus,
  discoverProjectConnection,
} from "./client/service-client.ts";
export { handlePendingAction } from "./interaction/handle-action.ts";
export type {
  ActionPresenter,
  Presentation,
  AnswerAsk,
} from "./interaction/contracts.ts";
export { actionForm, type ActionForm } from "./interaction/forms.ts";
export { codexConfiguration } from "./ide/codex/config.ts";
export type {
  ArtifactQuery,
  ArtifactSelector,
  ArtifactSummary,
} from "./application/artifacts.ts";
export { connectProjectClient } from "./client/mcp-client.ts";
export type {
  ProjectClient,
  ProjectConnection,
  ProjectClientOptions,
} from "./client/contracts.ts";
export type { RunSource } from "./application/entry.ts";
export type {
  RunView,
  PendingUserAction,
  RunErrorView,
  LoomView,
  StoredRecord,
  StoredArtifact,
  ListPage,
  ReadonlyJsonValue,
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
