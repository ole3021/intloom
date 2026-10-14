import styles from "./command.module.css";
import { useEffect, useState } from "react";

export function Command({
  command,
  compact = false,
}: {
  command: string;
  compact?: boolean;
}) {
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!status) return;
    const timeout = setTimeout(() => setStatus(""), 2000);
    return () => clearTimeout(timeout);
  }, [status]);
  return (
    <div className={styles["command-line"]} data-compact={compact}>
      <button
        type="button"
        aria-label={`Copy command: ${command}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(command);
            setStatus("Copied");
          } catch {
            setStatus("Select the command to copy");
          }
        }}
      >
        <span className={styles["command-prompt"]} aria-hidden="true">
          $
        </span>
        <code>{command}</code>
        {status === "Copied" ? (
          <Checkmark size={16} aria-hidden="true" />
        ) : (
          <Copy size={16} aria-hidden="true" />
        )}
      </button>
      <span className={styles["command-feedback"]} role="status">
        {status}
      </span>
    </div>
  );
}
import { Checkmark, Copy } from "@carbon/icons-react";
