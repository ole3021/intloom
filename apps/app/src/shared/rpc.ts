import type { Action, DesktopApi } from "./types.ts";
import type { UpdateCommand } from "./updates.ts";
export type StudioRPC = {
  bun: {
    requests: {
      previewLoom: {
        params: { source: string };
        response: Awaited<ReturnType<DesktopApi["previewLoom"]>>;
      };
      configuration: {
        params: { projectDir?: string };
        response: Awaited<ReturnType<NonNullable<DesktopApi["configuration"]>>>;
      };
      initialRoute: { params: undefined; response: string };
      snapshot: {
        params: undefined;
        response: Awaited<ReturnType<DesktopApi["snapshot"]>>;
      };
      update: { params: UpdateCommand; response: void };
      getRun: {
        params: { id: string };
        response: Awaited<ReturnType<DesktopApi["getRun"]>>;
      };
      listRuns: {
        params: Parameters<DesktopApi["listRuns"]>[0];
        response: Awaited<ReturnType<DesktopApi["listRuns"]>>;
      };
      act: { params: Action; response: Awaited<ReturnType<DesktopApi["act"]>> };
      pick: {
        params: { kind: "files" | "directory" | "file" };
        response: string[];
      };
      artifact: {
        params: { id: string; mode: "open" | "export" };
        response: string;
      };
    };
    messages: Record<never, never>;
  };
  webview: {
    requests: {
      notify: {
        params: { id: string; requestId: string; title: string; body: string };
        response: boolean;
      };
    };
    messages: { changed: Record<string, never> };
  };
};
