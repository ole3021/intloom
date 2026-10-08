import type { ReactNode } from "react";
import { useI18n, useLocation } from "@rspress/core/runtime";
import { useMotionControl } from "../motion/motion-provider.tsx";
import { usePageMotion } from "../motion/reveal.tsx";
import styles from "./site-frame.module.css";

export function SiteFrame({
  children,
  document,
}: {
  children: ReactNode;
  document: boolean;
}) {
  const { paused } = useMotionControl();
  const { pathname } = useLocation();
  const t = useI18n<typeof import("../../i18n.json")>();
  const ref = usePageMotion(paused, pathname);
  return (
    <div
      id="top"
      ref={ref}
      className={`${styles.frame} ${document ? styles.document : styles.marketing}`}
      data-site-frame
      data-paused={paused}
    >
      <a className={styles.skip} href="#main">
        {t("siteSkip")}
      </a>
      {children}
    </div>
  );
}
