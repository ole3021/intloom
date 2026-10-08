import { useEffect, useRef } from "react";
import { mountIntentField } from "./renderer.ts";
import styles from "./intent-field.module.css";

export function IntentField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) return mountIntentField(ref.current);
  }, []);
  return (
    <canvas
      ref={ref}
      className={styles.canvas}
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
