import type { ReactNode } from "react";
import styles from "./section-label.module.css";
export function SectionLabel({
  number,
  children,
}: {
  number: string;
  children: ReactNode;
}) {
  return (
    <div className={styles["section-label"]}>
      <span>{number} /</span>
      <span>{children}</span>
      <span aria-hidden="true">+</span>
    </div>
  );
}
