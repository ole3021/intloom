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
        <svg
          viewBox="0 0 20 20"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          aria-hidden="true"
        >
          {status === "Copied" ? (
            <path d="m4 10 4 4 8-9" />
          ) : (
            <>
              <rect x="7" y="7" width="10" height="10" />
              <path d="M13 4V2H2v11h2" />
            </>
          )}
        </svg>
      </button>
      <span className={styles["command-feedback"]} role="status">
        {status}
      </span>
    </div>
  );
}
