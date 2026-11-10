import type { ReactNode } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "./ui/alert-dialog";

import type { RunListItem } from "../../shared/types";
export function Heading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions}
    </div>
  );
}
export function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (v: string) => void;
}) {
  return (
    <NativeSelect
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-w-32"
    >
      {options.map(([id, name]) => (
        <NativeSelectOption value={id} key={id}>
          {name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
export function StateBadge({ run }: { run: RunListItem }) {
  return (
    <Badge
      variant={run.summary.status === "failed" ? "destructive" : "secondary"}
      className={
        run.summary.status === "waiting"
          ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          : ""
      }
    >
      {run.statusLabel}
    </Badge>
  );
}
export function Confirm({
  open,
  onClose,
  title,
  description,
  children,
  action,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children?: ReactNode;
  action: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>返回</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" onClick={onConfirm}>
              {action}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
export function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-2 text-sm">
      {items.map(([k, v]) => (
        <div className="grid grid-cols-[6rem_1fr] gap-3" key={k}>
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
export function when(t: string) {
  return new Date(t).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function duration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 60 ? `${s} 秒` : `${Math.floor(s / 60)} 分 ${s % 60} 秒`;
}
