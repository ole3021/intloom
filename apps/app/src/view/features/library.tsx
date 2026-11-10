import { useState } from "react";
import {
  Package,
  Presentation,
  Image,
  FileText,
  ArrowUpRight,
  Search,
  Plus,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { DropdownMenu } from "radix-ui";
import { InstallLoom } from "./install-loom";
import { Heading, Choice, Facts } from "@/components/common";
import { useRunList } from "../hooks/use-run-query";
import { RunRow } from "./runs";
import { navigate, useStudio } from "@/lib/studio";

import type { PackageInfo } from "../../shared/types";
const icons: Record<string, typeof Package> = {
  PPTX: Presentation,
  ZIP: Image,
  Markdown: FileText,
};
export function Library() {
  const { state } = useStudio(),
    [q, setQ] = useState(""),
    [format, setFormat] = useState("全部"),
    [manage, setManage] = useState(false);
  const catalog = state.catalog;
  const items = catalog.filter(
    (p) =>
      state.installed.includes(p.ref.id) &&
      (format === "全部" || p.format === format) &&
      [p.name, p.ref.id, p.description, p.format]
        .join(" ")
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <>
      <Heading
        title="Loom 库"
        description="本机全局安装的能力包与可执行命令。"
        actions={
          <Button onClick={() => setManage(true)}>
            <Plus />
            安装 Loom
          </Button>
        }
      />
      {manage && <InstallLoom onClose={() => setManage(false)} />}
      {state.installed.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              aria-label="搜索已安装的包"
              className="pl-9"
              placeholder="搜索名称、包名或用途"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Choice
            label="成果类型"
            value={format}
            onChange={setFormat}
            options={["全部", ...new Set(catalog.map((p) => p.format))].map(
              (x) => [x, x],
            )}
          />
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((p) => {
          const Icon = icons[p.format] ?? Package;
          return (
            <Card key={p.ref.id}>
              <CardHeader>
                <Icon className="mb-4 size-6" />
                <CardTitle>{p.name}</CardTitle>
                <CardDescription className="font-mono">
                  {p.ref.id} · {p.ref.version}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 text-sm text-muted-foreground">
                {p.description}
              </CardContent>
              <CardFooter className="justify-between">
                <Badge variant="secondary">{p.format}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    navigate(`/loom/${encodeURIComponent(p.ref.id)}`)
                  }
                >
                  {p.commands.length} 个命令
                  <ArrowUpRight />
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
      {!items.length && (
        <div className="grid justify-items-center gap-3 py-12">
          <Package className="size-7 text-muted-foreground" />
          <p>
            {state.installed.length ? "没有匹配的已安装包" : "还没有安装 Loom"}
          </p>
          {state.installed.length ? (
            <Button
              variant="outline"
              onClick={() => {
                setQ("");
                setFormat("全部");
              }}
            >
              清除筛选
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setManage(true)}>
              <Plus />
              安装 Loom
            </Button>
          )}
        </div>
      )}
    </>
  );
}
export function PackagePage({ pkg }: { pkg: PackageInfo }) {
  const { state, perform } = useStudio(),
    [removing, setRemoving] = useState(false),
    [name, setName] = useState(pkg.defaultCommand),
    c = pkg.commands.find((x) => x.name === name);
  const runs = useRunList({ loom: pkg.ref.id, limit: 6 })?.items ?? [];
  if (!c) throw new Error(`Unknown command: ${name}`);
  return (
    <>
      <Heading
        actions={
          state.installed.includes(pkg.ref.id) && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={removing}
                  aria-label="更多包操作"
                >
                  <MoreHorizontal />
                  更多
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={4}
                  className="z-50 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                >
                  <DropdownMenu.Item
                    className="flex cursor-default items-center gap-2 rounded-sm px-3 py-2 text-sm text-destructive outline-none focus:bg-accent"
                    onSelect={async () => {
                      setRemoving(true);
                      try {
                        if (
                          await perform({
                            type: "catalog",
                            id: pkg.ref.id,
                            install: false,
                          })
                        )
                          navigate("/looms");
                      } finally {
                        setRemoving(false);
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                    卸载 Loom
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )
        }
        title={pkg.name}
        description={`${pkg.ref.id} · ${pkg.ref.version} · ${pkg.description}`}
      />
      <div className="grid gap-5 md:grid-cols-[1fr_1.7fr]">
        <div className="space-y-2">
          <h2 className="text-sm font-medium">可用命令</h2>
          {pkg.commands.map((x) => (
            <Button
              key={x.name}
              className="w-full justify-between"
              variant={x.name === name ? "secondary" : "ghost"}
              onClick={() => setName(x.name)}
            >
              {x.title}
              {x.name === pkg.defaultCommand && (
                <Badge variant="outline">默认</Badge>
              )}
            </Button>
          ))}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{c.title}</CardTitle>
            <CardDescription>{c.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Facts
              items={[
                [
                  "需要提供",
                  c.textOrFile
                    ? "粘贴文本或选择一个本地文件"
                    : c.jsonSchema
                      ? "JSON 业务输入"
                      : Object.values(c.input.properties)
                          .map((f) => f.title)
                          .join("、"),
                ],
                ["预计交付", c.output],
              ]}
            />
          </CardContent>
          <CardFooter>
            <Button
              disabled={!state.installed.includes(pkg.ref.id)}
              onClick={() =>
                navigate(
                  `/launch/${encodeURIComponent(pkg.ref.id)}/${encodeURIComponent(c.name)}`,
                )
              }
            >
              填写启动参数
              <ArrowUpRight />
            </Button>
          </CardFooter>
        </Card>
      </div>
      <section className="space-y-2">
        <h2 className="font-semibold">这个包的运行记录</h2>
        <div className="divide-y rounded-lg border">
          {runs.slice(0, 6).map((r) => (
            <RunRow key={r.summary.id} run={r} />
          ))}
        </div>
        <Button
          variant="link"
          onClick={() =>
            navigate(`/history?loom=${encodeURIComponent(pkg.ref.id)}`)
          }
        >
          查看全部历史
        </Button>
      </section>
    </>
  );
}
