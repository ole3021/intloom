import { ChevronDown, ChevronRight, ChevronUp } from "@carbon/icons-react";
import type { ComponentProps } from "react";
import { ScrambledText } from "./motion/scrambled-text.tsx";

const siteOrigin = "https://intloom.ai";

export function LinkArrow({ href }: { href: string }) {
  const destination = new URL(href, siteOrigin);
  const external =
    destination.origin !== siteOrigin ||
    destination.pathname.startsWith("/download/") ||
    destination.pathname.startsWith("/downloads/");
  let Icon = ChevronRight;
  if (href.startsWith("#")) Icon = href === "#top" ? ChevronUp : ChevronDown;
  return (
    <Icon
      className="site-link-arrow"
      data-external={external || undefined}
      size={16}
      aria-hidden="true"
    />
  );
}

export function SiteLink({
  href,
  className = "",
  children,
  ...props
}: ComponentProps<"a"> & { href: string }) {
  return (
    <a {...props} href={href} className={`site-link ${className}`.trimEnd()}>
      {typeof children === "string" ? (
        <ScrambledText text={children} />
      ) : (
        children
      )}
      <LinkArrow href={href} />
    </a>
  );
}
