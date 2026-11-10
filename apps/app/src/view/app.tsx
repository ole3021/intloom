import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Activity,
  Clock3,
  History,
  Layers3,
  Server,
  Settings2,
  X,
} from "lucide-react";
import {
  SidebarProvider,
  SidebarInset,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbLink,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import logo from "../../../site/assets/logo.svg?url";
import { navigate, useRoute, useStudio } from "@/lib/studio";
import { RunCenter } from "./features/runs";
import { RunDetail } from "./features/detail";
import { LaunchPage } from "./features/launch";
import { PackagePage, Library } from "./features/library";
import { ServicePage } from "./features/service";
import { SettingsPage } from "./features/settings";

import { UpdateDetails, UpdateReminder } from "./features/studio-updates";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const positions = new Map<string, number>();
export function App() {
  const { state, perform, error, show, notice, dismiss } = useStudio(),
    { path, params } = useRoute(),
    [section = "", id, command] = path;
  const scroll = useRef<HTMLDivElement>(null),
    key = path.join("/");
  const [aboutDialog, setAboutDialog] = useState(false);
  const openAbout = useCallback(() => {
    if (document.querySelector("[data-update-draft]")) setAboutDialog(true);
    else navigate("/about");
  }, []);
  useEffect(() => {
    window.addEventListener("studio-about", openAbout);
    return () => window.removeEventListener("studio-about", openAbout);
  }, [openAbout]);
  useLayoutEffect(() => {
    const el = scroll.current;
    if (!el) return;
    el.scrollTop = positions.get(key) || 0;
    const remember = () => positions.set(key, el.scrollTop);
    el.addEventListener("scroll", remember);
    return () => el.removeEventListener("scroll", remember);
  }, [key]);
  const pkg = state.catalog.find((p) => p.ref.id === id);
  const selectedCommand = pkg?.commands.find((c) => c.name === command);
  const todo = state.runs.filter(
    (r) =>
      r.pending.length && ["waiting", "running"].includes(r.summary.status),
  );
  const waiting = todo.find((r) => r.pending.some((q) => q.id === notice));
  const links = [
    {
      name: "运行中心",
      path: "/",
      icon: Activity,
      active: ["", "run"].includes(section),
    },
    {
      name: "Loom 库",
      path: "/looms",
      icon: Layers3,
      active: ["loom", "looms", "launch"].includes(section),
    },
    {
      name: "全部运行",
      path: "/history",
      icon: History,
      active: section === "history",
    },
  ];
  const footer = [
    {
      name: "服务管理",
      path: "/service",
      icon: Server,
      active: section === "service",
    },
    {
      name: "运行配置",
      path: "/settings",
      icon: Settings2,
      active: section === "settings",
    },
  ];
  function menu(list: typeof links) {
    return (
      <SidebarMenu>
        {list.map((l) => (
          <SidebarMenuItem key={l.path}>
            <SidebarMenuButton
              tooltip={l.name}
              isActive={l.active}
              onClick={() => navigate(l.path)}
            >
              <l.icon />
              <span>{l.name}</span>
              {l.path === "/" && todo.length > 0 && (
                <Badge variant="secondary" className="ml-auto">
                  {todo.length}
                </Badge>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    );
  }
  const label =
    (
      {
        "": "运行中心",
        run: "Run 详情",
        history: "全部运行",
        looms: "Loom 库",
        loom: pkg?.name,
        launch: "启动 Run",
        service: "服务管理",
        settings: "运行配置",
        about: "关于 Studio",
      } as Record<string, string | undefined>
    )[section] || "页面";
  useEffect(() => {
    document.title = `${label} · IntLoom Studio`;
  }, [label]);
  let content: React.ReactNode;
  if (!section || section === "history")
    content = (
      <RunCenter key={section} all={section === "history"} params={params} />
    );
  else if (section === "run" && id) content = <RunDetail key={id} id={id} />;
  else if (section === "looms") content = <Library />;
  else if (section === "loom" && pkg)
    content = <PackagePage key={id} pkg={pkg} />;
  else if (section === "launch" && pkg && selectedCommand)
    content = (
      <LaunchPage
        key={id + command + (params.get("copy") || "")}
        pkg={pkg}
        command={selectedCommand}
        copy={params.get("copy")}
      />
    );
  else if (section === "service") content = <ServicePage />;
  else if (section === "settings") content = <SettingsPage />;
  else if (section === "about")
    content = (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">关于 Studio</h1>
        <section className="max-w-xl space-y-5 rounded-lg border p-5">
          <h2 className="font-semibold">IntLoom Studio</h2>
          <UpdateDetails />
        </section>
      </>
    );
  else
    content = (
      <Button onClick={() => navigate("/")}>记录不可用，返回运行中心</Button>
    );
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                onClick={openAbout}
                aria-label="关于 Studio"
                tooltip="关于 Studio"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-950">
                  <img src={logo} width="24" alt="" />
                </span>
                <div className="grid text-left leading-tight">
                  <span className="font-semibold">IntLoom Studio</span>
                  <span className="text-xs text-muted-foreground">
                    关于 Studio
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>工作空间</SidebarGroupLabel>
            {menu(links)}
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <UpdateReminder />
          {menu(footer)}
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="h-svh overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4!" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#/">工作台</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{label}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => navigate("/service")}
          >
            <span
              className={
                "size-2 rounded-full " +
                (state.service === "online"
                  ? "bg-green-600"
                  : "bg-muted-foreground")
              }
            />
            {state.mock ? "Mock Kernel" : "Kernel"} ·{" "}
            {
              { online: "在线", stopping: "关闭中", offline: "离线" }[
                state.service
              ]
            }
          </Button>
        </header>
        <div ref={scroll} className="min-h-0 flex-1 overflow-auto">
          <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-6 md:px-8">
            {state.service !== "online" && section !== "service" && (
              <div className="flex items-center justify-between rounded-lg border bg-muted px-4 py-2 text-sm">
                <span>
                  {state.service === "offline"
                    ? "Kernel 离线 · 展示最后记录的状态"
                    : "Kernel 正在等待停止回执"}
                </span>
                {state.service === "offline" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void perform({ type: "service", online: true })
                    }
                  >
                    启动服务
                  </Button>
                )}
              </div>
            )}
            {waiting && !(section === "run" && id === waiting.summary.id) && (
              <div
                className="new-event flex items-center gap-3 rounded-lg border border-amber-400/60 p-3 text-sm"
                role="status"
              >
                <Clock3 size={16} />
                <span className="flex-1">
                  {waiting.title} ·{" "}
                  {waiting.pending.find((q) => q.id === notice)?.message}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigate(
                      "/run/" +
                        encodeURIComponent(waiting.summary.id) +
                        "?request=" +
                        encodeURIComponent(notice),
                    );
                    dismiss();
                  }}
                >
                  查看请求
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="收起提醒"
                  onClick={dismiss}
                >
                  <X />
                </Button>
              </div>
            )}
            {error && (
              <div
                role="alert"
                className="flex items-center justify-between gap-4 rounded-lg border p-3 text-sm"
              >
                {error}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="关闭消息"
                  onClick={() => show("")}
                >
                  <X />
                </Button>
              </div>
            )}
            {state.connection?.issue && (
              <p role="alert">{state.connection.issue}</p>
            )}
            {state.service === "offline" && state.connection?.syncedAt && (
              <p>
                上次同步 {new Date(state.connection.syncedAt).toLocaleString()}
              </p>
            )}
            {content}
            {state.update.result && section !== "about" && (
              <p role="status" className="text-sm text-muted-foreground">
                {state.update.result}
              </p>
            )}
          </main>
        </div>
      </SidebarInset>
      <Dialog open={aboutDialog} onOpenChange={setAboutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>关于 Studio</DialogTitle>
            <DialogDescription>IntLoom Studio</DialogDescription>
          </DialogHeader>
          <UpdateDetails />
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
