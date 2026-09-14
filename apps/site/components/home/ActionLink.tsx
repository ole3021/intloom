import type { ReactNode } from "react";
import common from "./common.module.css";

export function ActionLink({
  href,
  children,
  variant,
  external = false,
}: {
  href: string;
  children: ReactNode;
  variant: "primary" | "text";
  external?: boolean;
}) {
  return (
    <a
      className={
        variant === "primary"
          ? `${common.button} ${common.buttonPrimary}`
          : common.textLink
      }
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
    >
      {children}{" "}
      <span aria-hidden="true">{variant === "primary" ? "↗" : "→"}</span>
    </a>
  );
}
