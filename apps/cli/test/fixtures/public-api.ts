import { connectProject, createCliCore, serviceStatus } from "@intloom/cli";
import type {
  CliIo,
  InstalledLoomList,
  ProjectDoctorResult,
  ProjectHost,
  StartHostOptions,
  StopServiceResult,
  ActionPresenter,
  Presentation,
  AnswerAsk,
  ActionForm,
  ArtifactQuery,
  ArtifactSelector,
  ArtifactSummary,
  ProjectClient,
  ProjectConnection,
  ProjectClientOptions,
  RunSource,
  StoredRecord,
  StoredArtifact,
  ListPage,
  ReadonlyJsonValue,
  RunView,
  PendingUserAction,
  RunErrorView,
  LoomView,
  CliCore,
  CoreResult,
  CoreMeta,
  ServiceRunView,
  ProjectEvent,
  ObserveOptions,
  WaitRunInput,
  WaitRunResult,
  ProjectInput,
  RunInput,
  StartRunInput,
  AnswerInput,
  BuildInput,
  BuildResult,
} from "@intloom/cli";

// Independent consumers must be able to name every supported public type.
export interface PublicTypes {
  CliIo: CliIo;
  InstalledLoomList: InstalledLoomList;
  ProjectDoctorResult: ProjectDoctorResult;
  ProjectHost: ProjectHost;
  StartHostOptions: StartHostOptions;
  StopServiceResult: StopServiceResult;
  ActionPresenter: ActionPresenter;
  Presentation: Presentation;
  AnswerAsk: AnswerAsk;
  ActionForm: ActionForm;
  ArtifactQuery: ArtifactQuery;
  ArtifactSelector: ArtifactSelector;
  ArtifactSummary: ArtifactSummary;
  ProjectClient: ProjectClient;
  ProjectConnection: ProjectConnection;
  ProjectClientOptions: ProjectClientOptions;
  RunSource: RunSource;
  StoredRecord: StoredRecord;
  StoredArtifact: StoredArtifact;
  ListPage: ListPage<never>;
  ReadonlyJsonValue: ReadonlyJsonValue;
  RunView: RunView;
  PendingUserAction: PendingUserAction;
  RunErrorView: RunErrorView;
  LoomView: LoomView;
  CliCore: CliCore;
  CoreResult: CoreResult<unknown>;
  CoreMeta: CoreMeta;
  ServiceRunView: ServiceRunView;
  ProjectEvent: ProjectEvent;
  ObserveOptions: ObserveOptions;
  WaitRunInput: WaitRunInput;
  WaitRunResult: WaitRunResult;
  ProjectInput: ProjectInput;
  RunInput: RunInput;
  StartRunInput: StartRunInput;
  AnswerInput: AnswerInput;
  BuildInput: BuildInput;
  BuildResult: BuildResult;
}
export const project: ProjectInput = { projectPath: "/project" };
export const wait: WaitRunInput = {
  ...project,
  runId: "RUN-example",
  until: "terminal",
  timeoutMs: 1000,
};
export function consume(core: CliCore): Promise<CoreResult<WaitRunResult>> {
  return core.waitRun(wait, { signal: new AbortController().signal });
}

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Assert<T extends true> = T;

// Keep this consumer contract independent of the private Kernel declarations.
type ExpectedServiceStatus = {
  version: 1;
  projectRoot: string;
  pid: number;
  instanceId: string;
  url: string;
  startedAt: string;
  storage: "file" | "sqlite";
  logFile?: string | undefined;
  execution?:
    | {
        useMcpAgent: boolean;
        serviceConfigured: boolean;
        preparedServiceAgents: number;
      }
    | undefined;
  logError?: { code: string; message: string; retryable: boolean } | undefined;
  loomCount: number;
  availableLoomCount: number;
  runningRuns: number;
  waitingRuns: number;
  pausedRuns?: number | undefined;
  completedRuns: number;
  failedRuns: number;
};

export type StatusParameters = Assert<
  Equal<Parameters<typeof serviceStatus>, [directory: string]>
>;
export type StatusReturn = Assert<
  Equal<ReturnType<typeof serviceStatus>, Promise<ExpectedServiceStatus>>
>;

export function consumeServiceStatus(directory: string) {
  const status = serviceStatus(directory);
  status satisfies Promise<ExpectedServiceStatus>;
  return status;
}

export function rejectInvalidStatusArguments() {
  // @ts-expect-error A project directory is required.
  serviceStatus();
  // @ts-expect-error The directory must be a string, not a numeric identifier.
  serviceStatus(123);
  // @ts-expect-error This entry accepts a directory, not a Core ProjectInput.
  serviceStatus(project);
  // @ts-expect-error Null cannot identify a project directory.
  serviceStatus(null);
  // @ts-expect-error Undefined cannot replace the required directory.
  serviceStatus(undefined);
  // @ts-expect-error Status queries do not accept a second options argument.
  serviceStatus(project.projectPath, {});
}

export type Client = Awaited<ReturnType<typeof connectProject>>;
export type Core = ReturnType<typeof createCliCore>;
export type Snapshot = ServiceRunView;
export type RunQuery = Awaited<ReturnType<Core["getRun"]>>;

export async function consumeProject(directory: string, runId: string) {
  const client: Client = await connectProject(directory, {
    requestId: "consumer-request",
  });
  client satisfies ProjectClient;
  const core: Core = createCliCore();
  core satisfies CliCore;
  const result: RunQuery = await core.getRun({
    projectPath: directory,
    runId,
  });
  result satisfies CoreResult<Snapshot>;
  if (result.ok) {
    result.data.runId satisfies string;
    result.data.serviceInstanceId satisfies string;
    result.data.revision satisfies number;
  }
  return { client, core, result };
}
