import styles from "./project-status.module.css";
import { Arrow } from "../../components/brand.tsx";

export function ProjectStatus() {
  return (
    <div className={styles["project-status"]}>
      <span className={styles["status-dot"]} />
      <p>
        <strong>Taking shape, in the open.</strong> IntLoom is in early
        development. Kernel, Compiler, persistent Storage, and CLI/MCP have
        implemented foundations. Specification is verified with controlled
        models; the wider workflow is a design direction. No production release
        yet.
      </p>
      <a href="/guide/status">
        Project status <Arrow />
      </a>
    </div>
  );
}
