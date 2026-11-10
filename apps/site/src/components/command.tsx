import styles from "./command.module.css";
import { useEffect, useState } from "react";

export function Command({
  command,
  compact = false,
  caption,
}: {
  command: string;
  compact?: boolean;
  caption?: string;
}) {
  const [feedback, setFeedback] = useState<{
    command: string;
    message: string;
  }>();
  const status = feedback?.command === command ? feedback.message : "";
  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(undefined), 2000);
    return () => clearTimeout(timeout);
  }, [feedback]);
  return (
    <div className={styles["command-line"]} data-compact={compact}>
      {caption && (
        <div className={styles.caption}>
          <span>{caption}</span>
          <span role="status" data-feedback={Boolean(status)}>
            {status || "Click to copy"}
          </span>
        </div>
      )}
      <button
        type="button"
        aria-label={`Copy command: ${command}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(command);
            setFeedback({ command, message: "Copied" });
          } catch {
            setFeedback({ command, message: "Select the command to copy" });
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
      {!caption && (
        <span className={styles["command-feedback"]} role="status">
          {status}
        </span>
      )}
    </div>
  );
}
import { Checkmark, Copy } from "@carbon/icons-react";
